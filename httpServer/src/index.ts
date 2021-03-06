import * as Hapi from '@hapi/hapi';
import { VolumeValuesController } from './Controllers/VolumeValuesController';
import { TestRepository } from './Repositories/TestRepository';
// eslint-disable-next-line no-unused-vars
import { IValuesRepository } from './Repositories/IValuesRepository';
import { MongoValuesRepository } from './Repositories/MongoValuesRepository';
import { TriggerValuesController } from './Controllers/TriggerValuesController';
import { PressureValuesController } from './Controllers/PressureValuesController';
import { BreathsPerMinuteValuesController } from './Controllers/BreathsPerMinuteValuesController';
import * as fs from 'fs';
// eslint-disable-next-line no-unused-vars
import { ISettingsRepository } from './Repositories/ISettingsRepository';
import { TestSettingsRepository } from './Repositories/TestSettingsRepository';
import { MongoSettingsRepository } from './Repositories/MongoSettingsRepository';
import { SettingsController } from './Controllers/SettingsController';
// eslint-disable-next-line no-unused-vars
import { MongoClient, Db } from 'mongodb';
import { PatientInfoController } from './Controllers/PatientInfoController';

/* define configuration */

const envData = fs.readFileSync('env.json', 'utf-8');
let environment = JSON.parse(envData);

if (fs.existsSync('env-local.json')) {
    const envLocalData = fs.readFileSync('env-local.json', 'utf-8');
    const environmentLocal = JSON.parse(envLocalData);
    environment = { ...environment, ...environmentLocal };
}

console.log(environment);

const host = environment.ListenInterface;
const port = environment.Port;

let mongoClient: MongoClient;

if (environment.RepositoryMode !== 'test') {
    let connectionString = `mongodb://${environment.DatabaseHost}:${environment.DatabasePort}/`;

    if (environment.WatchMode) {
        connectionString += '?connect=direct;replicaSet=rs0;readPreference=primaryPreferred';
    }

    mongoClient = new MongoClient(connectionString, { useUnifiedTopology: true, useNewUrlParser: true });
}

const valuesRepositoryFactory = function (): IValuesRepository {
    let repository: IValuesRepository = null;

    if (environment.RepositoryMode === 'test') {
        repository = new TestRepository();
    } else {
        repository = new MongoValuesRepository(mongoClient);
    }

    return repository;
};

const testSettingsRepository = new TestSettingsRepository();
const settingsRepositoryFactory = function (): ISettingsRepository {
    let repository: ISettingsRepository = null;

    if (environment.RepositoryMode === 'test') {
        repository = testSettingsRepository;
    } else {
        repository = new MongoSettingsRepository(mongoClient);
    }

    return repository;
};

const server: Hapi.Server = new Hapi.Server({
    host,
    port,
    routes: {
        cors: true,
    },
});

const start = async function () {
    /* add plugins to server */
    await server.register([require('@hapi/inert'), require('@hapi/nes')]);

    /* define routes */
    server.route({
        method: 'GET',
        path: '/{param*}',
        handler: {
            directory: {
                path: './ui/out',
                index: ['index.html', 'default.html'],
                listing: false,
            },
        },
    });

    server.route({
        method: 'GET',
        path: '/api/volume_values',
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => new VolumeValuesController(valuesRepositoryFactory()).HandleGet(request, h),
    });

    server.route({
        method: 'GET',
        path: '/api/pressure_values',
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => new PressureValuesController(valuesRepositoryFactory()).HandleGet(request, h),
    });

    server.route({
        method: 'GET',
        path: '/api/breathsperminute_values',
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => new BreathsPerMinuteValuesController(valuesRepositoryFactory()).HandleGet(request, h),
    });

    server.route({
        method: 'GET',
        path: '/api/trigger_values',
        handler: (request: Hapi.Request, h: Hapi.ResponseToolkit) => new TriggerValuesController(valuesRepositoryFactory()).HandleGet(request, h),
    });

    const broadcastSettings = (settings: any): void => {
        server.publish('/api/settings', settings);
    };

    server.route({
        method: 'GET',
        path: '/api/settings',
        handler: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => await new SettingsController(settingsRepositoryFactory(), broadcastSettings).HandleGet(request, h),
    });

    server.route({
        method: 'PUT',
        path: '/api/settings',
        handler: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => await new SettingsController(settingsRepositoryFactory(), broadcastSettings).HandlePut(request, h),
    });

    server.route({
        method: 'GET',
        path: '/api/patient_info',
        handler: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => await new PatientInfoController(settingsRepositoryFactory()).HandleGet(request, h),
    });

    server.route({
        method: 'PUT',
        path: '/api/patient_info',
        handler: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => await new PatientInfoController(settingsRepositoryFactory()).HandlePut(request, h),
    });

    server.route({
        method: 'PUT',
        path: '/api/error',
        handler: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => {
            server.publish('/api/error', request.payload);
            return {
                result: true,
            };
        },
    });

    server.route({
        method: 'GET',
        path: '/api/servertime',
        handler: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => {
            return { time: new Date().getTime() };
        },
    });

    server.subscription('/api/volume_values');
    server.subscription('/api/pressure_values');
    server.subscription('/api/breathsperminute_values');
    server.subscription('/api/trigger_values');
    server.subscription('/api/settings');
    server.subscription('/api/error');

    server.subscription('/api/servertime');

    await server.start();

    // start sending updates over websocket
    if (environment.RepositoryMode === 'test' || !environment.WatchMode) {
        const now = new Date();
        const lastDateTime = {
            volume_values: now,
            pressure_values: now,
            breathsperminute_values: now,
            trigger_values: now,
        };
        const valuesRepository = valuesRepositoryFactory();

        setInterval(async () => {
            for (const key in lastDateTime) {
                const newValues = await valuesRepository.ReadValues(key, lastDateTime[key]);

                if (newValues.length > 0) {
                    server.publish(`/api/${key}`, newValues);
                    lastDateTime[key] = newValues[newValues.length - 1].loggedAt;
                }
            };
        }, environment.UpdateRate);
    } else {
        if (!mongoClient.isConnected()) {
            await mongoClient.connect();
        }

        const db: Db = mongoClient.db('beademing');

        db.collection('pressure_values').watch().on('change', data => {
            if (data.operationType === 'insert') {
                server.publish('/api/pressure_values', [data.fullDocument]);
            }
        });

        db.collection('volume_values').watch().on('change', data => {
            if (data.operationType === 'insert') {
                server.publish('/api/volume_values', [data.fullDocument]);
            }
        });

        db.collection('trigger_values').watch().on('change', data => {
            if (data.operationType === 'insert') {
                server.publish('/api/trigger_values', [data.fullDocument]);
            }
        });

        db.collection('breathsperminute_values').watch().on('change', data => {
            if (data.operationType === 'insert') {
                server.publish('/api/breathsperminute_values', [data.fullDocument]);
            }
        });
    }
};

start();
