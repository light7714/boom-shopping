const process = require('process');
//to create secure unique random values to make token (postReset)
const crypto = require('crypto');

require('dotenv').config();

const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
//*validationResult is a fn that allows us to gather all error which prior validation middleware (like check('email').isEmail() on signup route in auth routes) might have stored.
const { validationResult } = require('express-validator');

const User = require('../models/user');

//*need to intialise transporter (telling nodemailer how emails to be sent)
//returns a configuration nodemailer can use to use sendgrid
const transporter = nodemailer.createTransport(
	sendgridTransport({
		auth: {
			//value to be obtained from sendgrid account (settings->api key->create new. added node-shop as name (one time))
			api_key: process.env.API_KEY,
		},
	})
);

exports.getLogin = (req, res, next) => {
	// console.log(req.flash('error'));
	//*pulling the msg out of session, only arg passed is key, if no error is flashed into the session, it will be an empty array (smh..?), else will be array of messages... (see more)
	let message = req.flash('error');
	if (message.length > 0) {
		message = message[0];
	} else {
		message = null;
	}

	//*We see true on sending different requests (going to diff pages) even though each req is technically separate from each other.
	//*Thats why if we open a new browser, we'll see undefined logged here.
	// console.log('Logged In:', req.session.isLoggedIn);
	res.render('auth/login', {
		path: '/login',
		pageTitle: 'Login',
		errorMessage: message,
		oldInput: {
			email: '',
			password: '',
		},
		validationErrors: [],
	});
};

exports.getSignup = (req, res, next) => {
	let message = req.flash('error');
	if (message.length > 0) {
		message = message[0];
	} else {
		message = null;
	}

	res.render('auth/signup', {
		path: '/signup',
		pageTitle: 'Signup',
		errorMessage: message,
		oldInput: {
			email: '',
			password: '',
			confirmPassword: '',
		},
		validationErrors: [],
	});
};

//*here,a session will be created with an id, a cookie having the specific session id (hashed) will be created
exports.postLogin = (req, res, next) => {
	const email = req.body.email;
	const password = req.body.password;
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		console.log(errors.array());
		return res.status('422').render('auth/login', {
			path: '/login',
			pageTitle: 'Login',
			errorMessage: errors.array()[0].msg,
			oldInput: {
				email: email,
				password: password,
			},
			validationErrors: errors.array(),
		});
	}
	//We can also put all this validation code in route also, but rn keeping it here only (thinking that its logic relateed code as well)
	//lhs is email field in doc, rhs is const email
	User.findOne({ email: email })
		.then((user) => {
			if (!user) {
				//*flashing an err msg to the session (so it can persist even after redirecting, and once we pull the msg (in getLogin) from session, it will be dltd), method added by connect-flash package
				//1st arg is key under which msg is stored, 2nd arg is msg
				// req.flash('error', 'Invalid email or password!');
				// return res.redirect('/login');

				//*now instead of flashing here, we render the page again with errors passed in the view itself
				return res.status('422').render('auth/login', {
					path: '/login',
					pageTitle: 'Login',
					errorMessage: 'Invalid email or password!',
					oldInput: {
						email: email,
						password: password,
					},
					// //adding obj with param as we are extracting param field in the view, adding both email and password to now show what exactly went wrong (or we could just remove validationErrors as in vid)
					// validationErrors: [
					// 	{
					// 		param: 'email',
					// 		param: 'password',
					// 	},
					// ],
					validationErrors: [],
				});
			}

			//if user exists, validating password
			//*1st arg is password to check, 2nd is hashed value to check against
			bcrypt
				.compare(password, user.password)
				.then((doMatch) => {
					//doMatch = true, when passwords match, otherwise false
					if (doMatch) {
						//session obj added by the session middleware in app.js, can add any key we want here.
						//*A new cookie connect.sid is set in browser, with a value of hashed session id. By default its session cookie (session here means it'll expire after closing browser (browser dependent))
						req.session.isLoggedIn = true;
						//* req.session.user is not a mongoose object, just plain object. https://stackoverflow.com/questions/18512461/express-cookiesession-and-mongoose-how-can-i-make-request-session-user-be-a-mon/18662693#18662693
						req.session.user = user;
						//*normally no need of writing session.save(), it'll automatically get saved in mongodb using the mongodb store, but as saving is async operation and we need to do redirect after saving, thats why doing writing save() method
						return req.session.save((err) => {
							if (err) {
								console.log(
									'err in session.save() in postLogin in auth.js:',
									err
								);
							}
							//*whenever any response is sent (or even req received), the session cookie will be sent along with it, so even if we do res.send(); the cookie will be sent
							res.redirect('/');
						});
					}

					// req.flash('error', 'Invalid email or password!');
					// res.redirect('/login');

					return res.status('422').render('auth/login', {
						path: '/login',
						pageTitle: 'Login',
						errorMessage: 'Invalid email or password!',
						oldInput: {
							email: email,
							password: password,
						},
						validationErrors: [],
					});
				})
				.catch((err) => {
					//**should do next(error here also though)
					//we'll get err only when something goes wrong, not if passwords dont match
					console.log('err in compare() in auth.js:', err);
					res.redirect('/login');
				});
		})
		.catch((err) => {
			// console.log('err in findById in auth.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

exports.postSignup = (req, res, next) => {
	const email = req.body.email;
	const password = req.body.password;
	// const confirmPassword = req.body.confirmPassword;	this already checked in route
	//*this will extract all errs added by check('email').isEmail() in signup route in auth routes
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		console.log(errors.array());
		//*422 status code -> validation failed
		//this will render the same page again, just with a different status code (so the page on which this post req was sent)
		return res.status(422).render('auth/signup', {
			path: '/signup',
			pageTitle: 'Signup',
			//*for now only taking the 1st one (but we should ouptut all errors) (working as rn in view, we added novalidate in form, or it would validate in browser itself). its msg field has been modified in auth routes in check('email').isEmail().withMessage('Please Enter a valid email')
			errorMessage: errors.array()[0].msg,
			//*sending this to be filled up again in input boxes so that if validation fails, user doesnt lose entered data
			oldInput: {
				email: email,
				password: password,
				confirmPassword: req.body.confirmPassword,
			},
			//*passed this for custom css styling in input in view (like if email and confirmPassword was wrong, the array will have 2 error objs with param field as email and confirmPassword, and then we can make those 2 inputs with red border)
			validationErrors: errors.array(),
		});
	}

	//*now doing this in validation step in the route
	// User.findOne({ email: email })
	// 	.then((userDoc) => {
	// 		//if even one doc with that email exists, we dont wanna create new user
	// 		if (userDoc) {
	// 			req.flash(
	// 				'error',
	// 				'Email exists already, please use a different one!'
	// 			);
	// 			return res.redirect('/signup');
	// 		}

	//*hashing the password before storage, 1st arg is what to hash, 2nd is salt (how many rounds of hashing to be applied, higher -> more secure -> longer it'll take)
	//*we wont be able to decrypt this (we'll be able to validate it by using compare fn, as bcrypt has the key)
	bcrypt
		.hash(password, 12)
		.then((hashedPassword) => {
			const user = new User({
				email: email,
				password: hashedPassword,
				cart: { items: [] },
			});
			return user.save();
		})
		.then((result) => {
			//redirecting immediately, not waiting for email to be sent (below), as even if email goes later its no problem (and sending email is slow, so dont block)
			res.redirect('/login');

			//sending an email after sign up, returns promise
			return transporter.sendMail({
				to: email,
				//verified account to send emails
				from: 'shubhamlightning99@gmail.com',
				subject: 'Sign Up succesfull!',
				html: '<h1>You successfully signed up chomu! 😎<h1>',
			});
		})
		.catch((err) => {
			// console.log('err in hash() chain in findOne() in auth.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

//* this will remove the session (logout button on nav bar)
exports.postLogout = (req, res, next) => {
	//destroy method by express-session package, the fn inside will be called when the session is destroyed
	//*after destroying, the session cookie still exists in browser, but its no prob as the session is deleted, the cookie with new session id will be set after logging in again
	//*actually after redirecting, a new session will be created again for csrf and flash (SO I SHOULD ACTUALLY DELETE isLoggedIn and user from session OR SET IT TO NULL)
	// req.session.destroy((err) => {
	// 	if (err) {
	// 		console.log('err in destroy() in postLogout:', err);
	// 	}
	// 	res.redirect('/');
	// });

	delete req.session.isLoggedIn;
	delete req.session.user;
	res.redirect('/');
};

exports.getReset = (req, res, next) => {
	let message = req.flash('error');
	if (message.length > 0) {
		message = message[0];
	} else {
		message = null;
	}
	res.render('auth/reset', {
		path: '/reset',
		pageTitle: 'Reset Password',
		errorMessage: message,
	});
};

//*need to generate a unique token with an expiry date so that the reset link includes that token, and we can verify that password is changed thru the link we sent only
exports.postReset = (req, res, next) => {
	//the cb is called when creation of 32 bytes is done
	crypto.randomBytes(32, (err, buffer) => {
		if (err) {
			console.log(err);
			return res.redirect('/reset');
		}
		//*buffer will have hex values, so passing hex to toString() to convert it into ascii
		const token = buffer.toString('hex');

		//*req.body.email is there cuz we passed email in the form's body in reset.ejs
		//then block will get undefined if we dont have that user
		User.findOne({ email: req.body.email })
			.then((user) => {
				if (!user) {
					req.flash('error', 'No account with that email found!');
					return res.redirect('/reset');
				}
				user.resetToken = token;
				//*Date.now() gives current time and date expired since 1970, in milliseconds, added 1 hour to it
				user.resetTokenExpiration = Date.now() + 3600000;
				return user.save();
			})
			.then((result) => {
				//*if block here because when user doesnt exist above, then after redirecting to /reset we dont wanna do anything else and we will get result as null
				if (result) {
					res.redirect('/');
					return transporter.sendMail({
						to: req.body.email,
						//verified account to send emails
						from: 'shubhamlightning99@gmail.com',
						subject: 'Reset Password',
						html: `
					<p>You requested a password reset</p>
					<p>Click this <a href="http://localhost:8000/reset/${token}">link</a> to set a new password, its valid for an hour</p>
					`,
					});
				}
			})
			.catch((err) => {
				// console.log('err in findOne() in auth.js:', err);
				const error = new Error(err);
				error.httpStatusCode = 500;
				return next(error);
			});
	});
};

//reset password page (url to here is /reset/:token)
exports.getNewPassword = (req, res, next) => {
	//got from url
	const token = req.params.token;
	// console.log('token', token);
	User.findOne({
		resetToken: token,
		//*resetTokenExpiration in db was stored as 1 hour above the time when it was stored, so if now time is more than 1 hour of resetTokenExpiration time (so now > reset Time), then condition wont match ($gt-> greater than)
		resetTokenExpiration: { $gt: Date.now() },
	})
		.then((user) => {
			let message = req.flash('error');
			if (message.length > 0) {
				message = message[0];
			} else {
				message = null;
			}
			res.render('auth/new-password', {
				path: '/new-password',
				pageTitle: 'New Password',
				errorMessage: message,
				//*passing userI so that we can include it in the post request after clicking update password button
				userId: user._id.toString(),
				//*token also passed so that someone doesnt go into dev tools, add a random user id in the hidden userId field and if the id matches a user, may edit their password. so that wont work now.
				passwordToken: token,
			});
		})
		.catch((err) => {
			// console.log('err in findOne() in auth.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

exports.postNewPassword = (req, res, next) => {
	//passed as hidden input in new password page
	//*token also passed so that someone doesnt go into dev tools, add a random user id in the hidden userId field and if the id matches a user, may edit their password. so that wont work now.
	const newPassword = req.body.password;
	const userId = req.body.userId;
	const passwordToken = req.body.passwordToken;
	let resetUser;

	User.findOne({
		resetToken: passwordToken,
		resetTokenExpiration: { $gt: Date.now() },
		_id: userId,
	})
		.then((user) => {
			// console.log(user);
			resetUser = user;
			return bcrypt.hash(newPassword, 12);
		})
		.then((hashedPassword) => {
			resetUser.password = hashedPassword;
			resetUser.resetToken = undefined;
			resetUser.resetTokenExpiration = undefined;

			return resetUser.save();
		})
		.then((result) => {
			res.redirect('/login');
		})
		.catch((err) => {
			// console.log('err in findOne() in auth.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};
