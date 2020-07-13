import React, { Component } from 'react';
import axios from './axios';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';


class FestivalRegistration extends Component {
    constructor(props) {
        super(props);
        this.state = {
            error: false,

        }
        this.selectedImage = this.selectedImage.bind(this);
        //this.submitImage = this.submitImage.bind(this);
    }

    handleChange(e) {
        console.log('e.target: ', e.target.value)
        this.setState({
            [e.target.name]: e.target.value
        })
    }

    selectedImage(event) {
        console.log('event:::::.', event.target.files[0])
        this.setState({
            file: event.target.files[0],
            name: event.target.files[0].imageName,
            selectedImage: true
        }, () => console.log('this.state uploading image: ', this.state));
        //console.log('upload image running')
    }

    // submitImage() {
    //     var formData = new FormData();
    //     formData.append('file', this.state.file);
    //     formData.append('name', this.state.imageName);

    //     axios.post('/uploadImage', formData).then(({ data }) => {
    //         console.log('upload image: ', data)
    //     }).catch(function (err) {
    //         console.log('err in POST', err)
    //     })
    // }




    handleClick() {

        console.log('this.state: ', this.state)
        axios.post('/festival-registration', this.state).then(({ data }) => {
            console.log('data from server: ', data)
            if (data.length != 0) {
                //log user into app
                location.replace('/home')
            } else {
                //div pop-up 'something went wrong'
                this.setState({
                    error: true
                });
            }
        }).catch(err => console.log('error ', err))
    }


    render() {
        return (
            <div className="festival-registration-container">
                <h2>Give us some information about your Festival</h2>
                {this.state.error && <div className="registration-error">Oops something went wrong!</div>}
                <div className="festival-registration">
                    {/* onChange={e => this.handleChange(e)} */}
                    <input id="name" name="name" placeholder="Name of the Festival" spellCheck="false" autoComplete="off" onChange={e => this.handleChange(e)} />

                    <input id="homepage" name="homepage" placeholder="Homepage " spellCheck="false" autoComplete="off" onChange={e => this.handleChange(e)} />

                    <input id="startingDate" name="startingDate" placeholder="Starting Day ('YYYY-MM-DD')" spellCheck="false" autoComplete="off" onChange={e => this.handleChange(e)} />

                    <input id="finishingDate" name="finishingDate" placeholder="Finishing Day ('YYYY-MM-DD')" spellCheck="false" autoComplete="off" onChange={e => this.handleChange(e)} />

                    <input id="location" name="location" placeholder="Location" spellCheck="false" autoComplete="off" onChange={e => this.handleChange(e)} />

                    <input id="price" name="price" placeholder="Price" spellCheck="false" autoComplete="off" onChange={e => this.handleChange(e)} />

                    <input id="style" name="style" placeholder="Style" spellCheck="false" autoComplete="off" onChange={e => this.handleChange(e)} />

                    <input id="confirmed_artists" name="confirmed_artists" placeholder="Confirmed Artists" spellCheck="false" autoComplete="off" onChange={e => this.handleChange(e)} />

                    <input type="file" id="url" className="upload-image" name="url" accept="image/*" multiple onChange={this.selectedImage} />

                    <button className="btn-submit-image" onClick={() => this.submitImage()}>Upload Image</button>

                    <textarea id="description" name="description" placeholder="Write some lines describing your festival" spellCheck="false" rows="12" cols="55" wrap="hard" onChange={e => this.handleChange(e)}></textarea>

                    <button className="btn-festival-registration" onClick={() => this.handleClick()}>Register Festival</button>
                </div>
                <br></br>
                {/* <p>Are you already registered?</p>
                <Link to="/login">Login</Link> */}
            </div>


            //short for Fragments---doesn't add another div
            // <>
            //     <h1>I am Registration!!!</h1>
            // </>
        );
    }
}

export default FestivalRegistration;
