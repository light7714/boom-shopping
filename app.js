const path = require('path');
const process = require('process');
const fs = require('fs');
const https = require('https');

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
//*require() gives a fn here, to which we pass our session, MongoDBStore is a constructor fn
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');
const rootDir = require('./util/path');
const errorController = require('./controllers/error');

const User = require('./models/user');

const app = express();
//all hosting providers automatically set process.env.PORT variable
const PORT = process.env.PORT || 8000;
const USER = process.env.DB_user;
const PASSWORD = process.env.DB_password;
const DB = process.env.DB_shop;

const MONGODB_URI = `mongodb+srv://${USER}:${PASSWORD}@cluster0.b6e3a.mongodb.net/${DB}?retryWrites=true&w=majority`;

const store = new MongoDBStore({
	uri: MONGODB_URI,
	collection: 'sessions',
});

//*csrfProtection can now be used as a middleware
const csrfProtection = csrf();

//commented this while deploying as it will done thru heroku's managed server
//should use try catch here
//to use https, we need to read in our cert and pvt key files
//its synchronous reading, we only proceed after reading
// const privateKey = fs.readFileSync(path.join(__dirname, 'server.key'));
// const certificate = fs.readFileSync(path.join(__dirname, 'server.cert'));

//*diskStorage is a storage engine, destination and filename as fns which multer will call for an incoming file
const fileStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		//1st arg is error msg to inform multer something is wrong with incoming file, if its null, we're telling multer its okay to store it, 2nd arg is path where we wanna store it
		cb(null, 'images');
	},
	filename: (req, file, cb) => {
		//originalname holds the original name as uploaded (with extension), filename holds a random hashed value (done this to ensure no 2 files have same name)
		// cb(null, file.filename + '-' + file.originalname);
		//but that wont work cus as made our own name, multer didnt autogenerate hashed value
		cb(null, new Date().getTime() + '-' + file.originalname);
	},
});

const fileFilter = (req, file, cb) => {
	//1st arg is null if no err, 2nd is true if we want to store that file, flase if we dont want to store it (req.file will have undefined member)
	//mimetype is like extension
	if (
		file.mimetype === 'image/png' ||
		file.mimetype === 'image/jpg' ||
		file.mimetype === 'image/jpeg'
	) {
		cb(null, true);
	} else {
		cb(null, false);
	}
};

//*solution to queries and outputs being logged twice in console, as browser again sends a request when it doesnt find favicon
app.get('/favicon.ico', (req, res) => res.sendStatus(204));

app.set('view engine', 'ejs');
app.set('views', 'views');

// using helmet package for it, will add certain headers to responses we send, see docs to see which headers it sets to mitigate some attack patterns.
app.use(helmet());

//for compression of assets, only files above 1kb are compressed. img files are not compressed, as it makes them longer to load
app.use(compression());

// 'a' flag means append
const accessLogStream = fs.createWriteStream(
	path.join(__dirname, 'access.log'),
	{ flags: 'a' }
);

// morgan package for logging. logs out info on console by default, stream value streams the logs to the writable stream we created (which is to a file named access.log)
//often logging is done by hosting providers though
app.use(morgan('combined', { stream: accessLogStream }));

//urlencoded means text data (so cant submit image for eg.)
app.use(express.urlencoded({ extended: false }));

//*.single() means we expect only 1 file (in each for data, as it'll go thru all till it finds a form with enctype multipart/form-data). image, cuz in form we write name="image"
//will store image in an images folder with random name, doesnt have an extension rn
// app.use(multer({dest: 'images'}).single(image));
app.use(
	multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')
);

app.use(express.static(path.join(rootDir, 'public')));
//also serving images statically (as we're storing path to them in the db)
//*when serving static files, express will serve them as if they are on the root folder. But in views, as the path passed is /images/..., the get request will be sent to /images (but we can access images on /)
// app.use(express.static(path.join(rootDir, 'images')));
//this means that if we have a req that goes to /images, then serve the files statically
app.use('/images', express.static(path.join(rootDir, 'images')));

//*secret is used for signing the hash which stores id of session in the cookie, can pass anything (should be a long string).
//resave: false means session wont be saved on every req received, but only if something changed in the session (improves performance)
//"saveUninitialized is for saving sessions that are new, but have not been modified. If you set it to false then empty sessions won't be stored in the database."       ???
//*matches session with cookie if present
app.use(
	session({
		secret: process.env.session_secret,
		resave: false,
		saveUninitialized: false,
		//session will be stored in mongodb collection sessions
		store: store,
		//can also configure the session cookie here
		// cookie{expires: }	cookie{maxAge: }
	})
);

//* when not logged in, it'll create a session on which the msg (err msg rn) will be flashed, and then pulled out, but still that session will exist with empty flash obj. After logging in, in that same session isLoggedIn and user obj will be stored. SO new sessions are not created, on that same session data is stored (on that session only the csrf token is also there)

//*next 2 middlewares come after initiliasing the session, as they use the session, will check incoming post (or any state changing) req for correct csrf token
//looks for csrf token in body, query params and headers (in body it looks for _csrf name, it headers for csrf-token header)
app.use(csrfProtection);
app.use(flash());

//*location is imp
//*We need to pass isAuthenticated and csrfToken variables in every rendered view
app.use((req, res, next) => {
	//*locals field on response obj allows us to set local variables that are always passed into the views (local as they'll only exist in views that are rendered)
	res.locals.isAuthenticated = req.session.isLoggedIn;
	//method provided by csrf middleware
	res.locals.csrfToken = req.csrfToken();
	next();
});

app.use((req, res, next) => {
	// throw new Error('hi');
	//*inside sync code, whenever we throw an error (not inside try catch ofc), the error handling middleware below will automatically catch this error, but in async code (like in then block) we have to pass the error obj in next
	// throw new Error('Sync Dummy');

	//* req.session.user added after login (auth.js), it is not a mongoose object, just plain object
	if (!req.session.user) {
		return next();
	}
	//mongoose static method findById
	User.findById(req.session.user._id)
		.then((user) => {
			//*even tho we check if req.session.user exists or not, still we can have a scenario where user doesnt exist (maybe its deleted in the database in-between)
			if (!user) {
				//so if user didnt exist, not storing an undefined ibj in req.user
				return next();
			}

			//*user here is mongoose obj (doc) with all methods, found using req.session.user, which was not a full mongoose obj
			req.user = user;
			next();
		})
		.catch((err) => {
			// console.log('err in findById() in app.js:', err);
			next(new Error(err));
		});
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);
// app.get('/500', errorController.get500);
app.use(errorController.get404);

//*normally this will never be reached, as above get404 middleware handles catches all other routes
//*this error handling middleware receives 4 args instead of 3. control will go here whenever we call next() with an error obj passed in its arg
//*if there are more than 1 error handling middlewares, they'll execute top to bottom
app.use((error, req, res, next) => {
	//if we wanna do something else than pass 500 err page, we could do like (will do later in course)
	// res.status(error.httpStatusCode).render();
	console.log(error);
	//*redirect can trigger infinte loops when error is thrown in sync code using throw new Error('') in any above middleware, as then it'll loop again thru code
	// res.redirect('/500');

	// console.log('hello', res);
	errorController.get500(req, res, next);
});

//these options set to remove all warnings, see depreciation docs
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

mongoose
	.connect(MONGODB_URI)
	.then((result) => {
		app.listen(PORT, () => {
			console.log(`Listening on port ${PORT}`);
			console.log('NODE_ENV env variable:', process.env.NODE_ENV);
		});

		//not using below https code, as we wanna let hosting provider handle tls certificate

		//1st arg configures the server, we need to point it to our pvt key and cert, 2nd arg is req handler (here, our express application)
		// https
		// 	.createServer({ key: privateKey, cert: certificate }, app)
		// 	.listen(PORT, () => {
		// 		console.log(`Listening on port ${PORT}`);
		// 		console.log('NODE_ENV env variable:', process.env.NODE_ENV);
		// 	});
	})
	.catch((err) => {
		console.log('err in mongoose.connect in app.js:', err);
	});

//sometimes process keeps on running even after ctrl+c (dunno why), thats why added this (still not solved..???)
process.on('SIGINT', () => {
	console.log('\nShutting down');
	process.exit(1);
});
