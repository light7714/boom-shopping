const express = require('express');
//its made of sub-packages, like the check package here. (in vid is require('express-validator/check, but thats deprecated now'))
const { check, body } = require('express-validator');

const authController = require('../controllers/auth');
const isAuth = require('../middleware/is-auth');
const User = require('../models/user');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.post(
	'/login',
	[
		body('email')
			.isEmail()
			.withMessage('Please Enter a valid email')
			.normalizeEmail(),
		body(
			'password',
			'Please enter a password with minimum 4 characters, and it should only contain numbers and letters'
		)
			.isLength({ min: 4 })
			.isAlphanumeric()
			.trim(),
	],
	authController.postLogin
);

//*we pass the field's name which we wanna validate (in the view, in the input we passed name="email", thats why we use 'email' here).
//the check fn returns an obj, we call a method on it which finally returns a middleware.

//*isEmail() will check the email field on the incoming request (it looks for the field in body, query params, headers and cookies.. we can import just body, or params, etc. to check just them). It will add any possible errors on the request body which can be extracted later
//* withMessage() will replace the error object's msg field to have that new message (this fn always refers to the validation method just before it, here, its isEmail(), as we can add multiple validation methods)
//*for more builtin validators, see docs (express-validator was a wrapper to validator.js, so see its docs)
//*custom validators: for eg if we want a specific email (tho it exists in built in validator, just making own to demonstrate). custom fn  receives value of the field we're checking (bere, email), an obj from which we can extract things (by destructuring), like the location, path, request (req in case we wanna extract more from request).
//*adding all checks in array is optional
router.post(
	'/signup',
	[
		//*tho we should look only in the body here too
		check('email')
			.isEmail()
			//*overwriting default msg value in error obj
			.withMessage('Please Enter a valid email')
			//*custom basically expects a true, or a false, or an error or a promise to be returned. If its a promise, it'll wait for it to be fulfilled, if fulfilled wihtout error, then validation is successful, if resolved with a rejection, then it'll store it as an error
			.custom((value, { req }) => {
				// //dummy: not allowing this email
				// if (value === 'test@test.com') {
				// 	//*we go out of the fn if something is thrown or false is returned, else we return true below
				// 	throw new Error('This email is forbidden');
				// }
				// //*if we succeed, we should return true, it'll then throw no error (could return false to go with default error msg)
				// return true;

				//async validation here
				return User.findOne({ email: value }).then((userDoc) => {
					//if even one doc with that email exists, we dont wanna create new user
					if (userDoc) {
						//returns a promise which resolves to an error
						return Promise.reject(
							'Email exists already, please use a different one!'
						);
					}
				});
			})
			//normaliseEmail() is a sanitisation feature, makes email with letters small, no extra whitespace
			.normalizeEmail(),

		//*if we want to override default err msg in all checks, instead of attaching withMessage to all checks here (isLength, isAlphanumeric), we can pass the msg in the body (or check or anything here) function
		body(
			'password',
			'Please enter a password with minimum 4 characters, and it should only contain numbers and letters'
		)
			.isLength({ min: 4 })
			//*isAlphanumeric allows only numbers and letters
			.isAlphanumeric()
			//removes excess whitespace
			.trim(),

		body('confirmPassword')
			.custom((value, { req }) => {
				if (value !== req.body.password) {
					throw new Error('Passwords not matching!');
				}
				return true;
			})
			.trim(),
	],
	authController.postSignup
);

// this will remove the session (logout button on nav bar)
router.post('/logout', isAuth, authController.postLogout);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getNewPassword);

router.post('/new-password', authController.postNewPassword);

module.exports = router;
