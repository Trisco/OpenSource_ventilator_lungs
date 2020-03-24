import React from 'react';
import cx from 'classnames';
import MasterLayout from '../components/master-layout';

export class PatientInformation extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
<<<<<<< HEAD
            firstName: '',
            lastName: '',
            admittanceDate: null,
            info: '',
        };
    }

    async componentDidMount() {
        // Get the information about the patient
        const res = await fetch('http://localhost:3001/api/patient_info');
        const resData = await res.json();

        console.log(resData);

        this.setState({
            firstName: resData.firstName,
            lastName: resData.lastName,
            admittanceDate: resData.admittanceDate,
            info: resData.info,
        });
    }

=======
            firstName: 'John',
            name: 'Doe',
            dateOfAdmission: new Date().toLocaleDateString(),
        };
    }

>>>>>>> WIP: patient information form
    render() {
        return (
            <MasterLayout>
                <form action="" className="form">
                    <div className="form__group">
                        <label htmlFor="firstname" className="form__label">First name</label>
                        <input type="text" className="form__control" id="firstname" value={this.state.firstName} />
                    </div>
                    <div className="form__group">
<<<<<<< HEAD
                        <label htmlFor="lastname" className="form__label">Last name</label>
                        <input type="text" className="form__control" id="name" value={this.state.lastName} />
                    </div>
                    <div className="form__group">
                        <label htmlFor="admittancedate" className="form__label">Admittance Date</label>
                        <input type="text" className="form__control" id="admittancedate" value={this.state.admittanceDate} />
                    </div>
                    <div className="form__group">
                        <label htmlFor="info" className="form__label">Info</label>
                        <input type="text" className="form__control" id="info" value={this.state.info} />
=======
                        <label htmlFor="name" className="form__label">Name</label>
                        <input type="text" className="form__control" id="name" value={this.state.name} />
                    </div>
                    <div className="form__group">
                        <label htmlFor="dateOfAdmission" className="form__label">Date of admission</label>
                        <input type="text" className="form__control" id="dateOfAdmission" value={this.state.dateOfAdmission} />
>>>>>>> WIP: patient information form
                    </div>
                    <input type="submit" className="btn btn--secondary" />
                </form>
            </MasterLayout >
        );
    };
}

export default PatientInformation;
