// eslint-disable-next-line no-unused-vars
import MasterLayout from '../components/master-layout';
import { Client } from '@hapi/nes/lib/client';
// eslint-disable-next-line no-unused-vars
import DataPlot from '../components/data-plot';
import dynamic from 'next/dynamic';

// eslint-disable-next-line no-unused-vars
const SingleValueDisplay = dynamic(() => import('../components/single-value-display').then(mod => mod.SingleValueDisplay), { ssr: false });

// eslint-disable-next-line no-unused-vars
const SmallSingleValueDisplay = dynamic(() => import('../components/single-value-display').then(mod => mod.SmallSingleValueDisplay), { ssr: false });

// eslint-disable-next-line no-unused-vars
const StaticSingleValueDisplay = dynamic(() => import('../components/single-value-display').then(mod => mod.StaticSingleValueDisplay), { ssr: false });

import React from 'react';
import DataCard from '../components/data-card';
import BellIcon from '../components/icons/bell';

import { getApiUrl, getWsUrl } from '../helpers/api-urls';

import { toast } from 'react-toastify';

const refreshRate = 50;
const defaultXRange = 10000;
const integerPrecision = 1;
let serverTimeCorrection = 0;

export default class Index extends React.Component {
    rawPressureValues = [];
    rawVolumeValues = [];
    rawTriggerValues = [];
    rawBpmValue = 0;
    animationInterval = 0;
    client = null;
    dirtySettings = {};
    previousSettings = {};

    constructor(props) {
        super(props);

        this.state = {
            pressureValues: [],
            volumeValues: [],
            triggerValues: [],
            xLengthMs: defaultXRange,
            lastPressure: 0,
            lastVolume: 0,
            pressureStatus: 'normal',
            volumeStatus: 'normal',
            bpmStatus: 'normal',
            bpmValue: 0,
            patientName: '',
            patientAdmittanceDate: new Date(),
            patientInfo: '',
            settings: {
                RR: 0,
                VT: 0,
                PK: 0,
                TS: 0,
                IE: 0,
                PP: 0,
                ADPK: 0,
                ADVT: 0,
                ADPP: 0,
                MODE: 'V',
                ACTIVE: '',
            },
            hasDirtySettings: false,
            updateSetting: (key, setting) => {
                const settings = { ...this.state.settings };

                settings[key] = setting;
                this.dirtySettings[key] = setting;
                this.setState({
                    settings,
                    hasDirtySettings: true,
                });
            },
        };
    }

    processIncomingPoints(toArray, newPoints) {
        var cutoffTime = new Date().getTime() - this.state.xLengthMs;

        // shift old values
        let i = 0;
        for (i = 0; i < toArray.length; i++) {
            if (toArray[i].x > cutoffTime) {
                break;
            }
        }

        if (i > 0) {
            toArray.splice(0, i);
        }

        newPoints.forEach((newPoint) => {
            toArray.push({
                x: new Date(newPoint.loggedAt).getTime(),
                y: newPoint.value,
            });
        });
    }

    async saveSettings(ev) {
        try {
            // returncomplete also makes sure the python code and controller only receive the changed values
            await fetch(`${getApiUrl()}/api/settings?returncomplete=false`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.dirtySettings),
            });

            this.dirtySettings = {};
            this.previousSettings = this.state.settings;

            this.setState({
                hasDirtySettings: false,
            });
        } catch (e) {
            // todo: show error to the user
            console.log(e);
        }

        ev.preventDefault();
    }

    revertSettings() {
        this.setState({
            settings: { ...this.previousSettings },
        });
    }

    async componentDidMount() {
        // Get patient information
        try {
            const patientInfoResponse = await fetch(`${getApiUrl()}/api/patient_info`);
            const patientInfoData = await patientInfoResponse.json();

            this.setState({
                patientName: patientInfoData.lastName + ', ' + patientInfoData.firstName,
                patientAdmittanceDate: new Date(patientInfoData.admittanceDate),
                patientInfo: patientInfoData.info,
            });
        } catch (ex) {
            console.log(ex);
            toast.error('Error fetching patient information.', {
                autoClose: false,
            });
        }

        try {
            const settingsResponse = await fetch(`${getApiUrl()}/api/settings`);
            const settingsData = await settingsResponse.json();

            this.setState({
                settings: { ...this.state.settings, ...settingsData },
            });
        } catch (ex) {
            console.log(ex);
            toast.error('Error fetching settings information.', {
                autoClose: false,
            });
        }

        // ask the server for the time
        if (!(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            try {
                // kind of naive, but good enough for what we need
                const loop = 10;
                let summedTimeValues = 0;

                for (let j = 0; j < loop; j++) {
                    const now = new Date().getTime();
                    const serverTimeResponse = await fetch(`${getApiUrl()}/api/servertime`);
                    const serverTimeJson = await serverTimeResponse.json();

                    summedTimeValues += serverTimeJson.time - now;
                }

                serverTimeCorrection = Math.floor(summedTimeValues / loop);

                console.log(`Time has to be corrected with ${serverTimeCorrection} ms`);
            } catch (ex) {
                console.log(ex);
                toast.error('Error fetching time information.', {
                    autoClose: false,
                });
            }
        }

        // todo: no hardcoded values
        this.client = new Client(`${getWsUrl()}`);
        await this.client.connect();

        this.client.subscribe('/api/pressure_values', (newPoints) => {
            this.processIncomingPoints(this.rawPressureValues, newPoints);
        });

        this.client.subscribe('/api/volume_values', (newPoints) => {
            this.processIncomingPoints(this.rawVolumeValues, newPoints);
        });

        this.client.subscribe('/api/trigger_values', (newPoints) => {
            this.processIncomingPoints(this.rawTriggerValues, newPoints);
        });

        const self = this;
        this.client.subscribe('/api/breathsperminute_values', (newPoints) => {
            const lastpoint = newPoints[newPoints.length - 1];

            self.rawBpmValue = lastpoint.value;
        });

        this.animationInterval = setInterval(() => {
            var now = new Date().getTime();
            const newPressureValues = [];
            const newVolumeValues = [];
            const newTriggerValues = [];

            this.rawPressureValues.forEach((point) => {
                var newX = (point.x - now - serverTimeCorrection);

                if (newX <= 0 && newX >= -this.state.xLengthMs) {
                    newPressureValues.push({
                        y: point.y / integerPrecision,
                        x: newX / 1000.0,
                    });
                }
            });

            this.rawVolumeValues.forEach((point) => {
                var newX = (point.x - now - serverTimeCorrection);

                if (newX <= 0 && newX >= -this.state.xLengthMs) {
                    newVolumeValues.push({
                        y: point.y / integerPrecision,
                        x: newX / 1000.0,
                    });
                }
            });

            this.rawTriggerValues.forEach((point) => {
                var newX = (point.x - now - serverTimeCorrection);

                if (newX <= 0 && newX >= -this.state.xLengthMs) {
                    newTriggerValues.push({
                        y: point.y * 400,
                        x: newX / 1000.0,
                    });
                }
            });

            self.setState({
                pressureValues: newPressureValues,
                volumeValues: newVolumeValues,
                triggerValues: newTriggerValues,
                pressureStatus: 'normal',
                bpmStatus: 'normal',
                volumeStatus: 'normal',
                bpmValue: self.rawBpmValue,
                lastPressure: newPressureValues.length > 0 ? newPressureValues[newPressureValues.length - 1].y : 0.0,
                lastVolume: newVolumeValues.length > 0 ? newVolumeValues[newVolumeValues.length - 1].y : 0.0,
            });
        }, refreshRate);
    }

    async componentWillUnmount() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
        }

        try {
            await this.client.disconnect();
        } catch (e) {
            console.log(e);
        }
    }

    setSliderValue(ev) {
        this.setState({
            xLengthMs: ev.target.value,
        });
    }

    render() {
        return (
            <MasterLayout>
                <div className="page-dashboard">
                    <div className="page-dashboard__header">
                        <ul className="list--inline page-dashboard__patient-info">
                            <li>{this.state.patientName}</li>
                            <li>{this.state.patientAdmittanceDate.toLocaleString()}</li>
                            <li>{this.state.patientInfo}</li>
                        </ul>
                        <div className="page-dashboard__timing-info">
                            <div>
                                T {new Date().toLocaleTimeString()}
                            </div>
                            <div>
                                Mode: {this.state.settings.MODE}
                            </div>
                        </div>
                        <div className="page-dashboard__machine-info">
                            Machine #00001
                        </div>
                    </div>

                    <div className="page-dashboard__body">
                        <div className="page-dashboard__alert alert alert--danger" hidden>Trigger parameter has alert</div>

                        <div className="row u-mt-1">
                            <div className="col--md-8">
                                <form className="form form--horizontal-xs">
                                    <div className="form__group">
                                        <label className="form__label" htmlFor="interval">Interval</label>
                                        <input type="range" min="5000" max="60000" step="5000" id="interval" defaultValue={defaultXRange} onChange={(ev) => this.setSliderValue(ev)} className="form__control" />
                                    </div>
                                    <div className="form__group form__group--shrink">
                                        <div className="option-toggle option-toggle--danger">
                                            <input type="checkbox" id="alarm" />
                                            <label htmlFor="alarm">
                                                <BellIcon size="md" />
                                            </label>
                                        </div>
                                    </div>
                                </form>
                                <div className="box u-mt-1">
                                    <div className="box__body">
                                        <DataPlot title='Pressure (cmH2O)'
                                            data={this.state.pressureValues}
                                            timeScale={this.state.xLengthMs / 1000.0}
                                            minY={-20}
                                            maxY={80}
                                            peak={this.state.settings.PK}
                                            threshold={this.state.settings.ADPK} />
                                        <DataPlot title='Volume (mL)'
                                            data={[this.state.volumeValues, this.state.triggerValues]}
                                            multipleDatasets={true}
                                            timeScale={this.state.xLengthMs / 1000.0}
                                            minY={-300}
                                            maxY={800} />
                                    </div>
                                </div>
                            </div>
                            <div className="col--md-4">
                                <SingleValueDisplay name="Pressure"
                                    value={this.state.lastPressure}
                                    status={this.state.pressureStatus}>
                                    <SmallSingleValueDisplay name="Set peak pressure"
                                        value={this.state.settings.PK}
                                        unit="cmH2O"
                                        settingKey={'PK'}
                                        decimal={false}
                                        step={1}
                                        updateValue={this.state.updateSetting} />
                                    <SmallSingleValueDisplay name="Threshold"
                                        value={this.state.settings.ADPK}
                                        unit="cmH2O"
                                        settingKey={'ADPK'}
                                        decimal={false}
                                        step={1}
                                        updateValue={this.state.updateSetting} />
                                </SingleValueDisplay>
                                <SingleValueDisplay name="Respiratory rate"
                                    value={this.state.bpmValue}
                                    status={this.state.bpmStatus}>
                                    <SmallSingleValueDisplay name="Set RR value"
                                        value={this.state.settings.RR}
                                        settingKey={'RR'}
                                        unit="bpm"
                                        step={1}
                                        decimal={false}
                                        updateValue={this.state.updateSetting} />
                                </SingleValueDisplay>
                                <SingleValueDisplay name="Volume"
                                    value={this.state.lastVolume}
                                    status={this.state.volumeStatus}>
                                    <SmallSingleValueDisplay name="Set Value"
                                        value={this.state.settings.VT}
                                        settingKey={'VT'}
                                        unit="mL"
                                        step={10}
                                        decimal={false}
                                        updateValue={this.state.updateSetting} />
                                    <SmallSingleValueDisplay name="Threshold"
                                        value={this.state.settings.ADVT}
                                        settingKey={'ADVT'}
                                        unit="mL"
                                        step={10}
                                        decimal={false}
                                        updateValue={this.state.updateSetting} />
                                </SingleValueDisplay>
                                {/* <SingleValueDisplay name="PEEP"
                                    value={this.state.lastPressure}
                                    status={this.state.pressureStatus}>
                                    <SmallSingleValueDisplay name="Set PEEP"
                                        value={this.state.settings.PK}
                                        unit="cmH2O"
                                        settingKey={'PK'}
                                        decimal={false}
                                        updateValue={this.state.updateSetting} />
                                    <SmallSingleValueDisplay name="Threshold"
                                        value={this.state.settings.ADPK}
                                        unit="cmH2O"
                                        settingKey={'ADPK'}
                                        decimal={false}
                                        updateValue={this.state.updateSetting} />
                                </SingleValueDisplay>
                                <StaticSingleValueDisplay>
                                    <SmallSingleValueDisplay name="I/E"
                                        value={'1:3'}
                                        decimal={false} />
                                    <SmallSingleValueDisplay name="Trigger Peak value"
                                        value={0}
                                        decimal={false}
                                        unit='ml' />
                                </StaticSingleValueDisplay> */}

                                {this.state.hasDirtySettings &&
                                    <button className="btn btn--primary" onClick={(ev) => this.saveSettings(ev) }>
                                        Save settings
                                    </button>
                                }
                            </div>
                        </div>
                    </div>
                </div>
            </MasterLayout>
        );
    }
};
