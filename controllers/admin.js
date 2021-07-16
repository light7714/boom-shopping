const { validationResult } = require('express-validator');

const Product = require('../models/product');
const fileHelper = require('../util/file');

const errorController = require('./error');

exports.getAddProduct = (req, res, next) => {
	res.render('admin/edit-product', {
		pageTitle: 'Add Product',
		path: '/admin/add-product',
		editing: false,
		//when hasError is false, no need to pass product
		hasError: false,
		errorMessage: null,
		validationErrors: [],
	});
};

exports.postAddProduct = (req, res, next) => {
	const title = req.body.title;
	//will store array of files
	//image will be an obj with info like name, mimetype, path where its stored, size, etc
	const image = req.file;
	const price = req.body.price;
	const description = req.body.description;
	// console.log(imageUrl);
	//*image will be undefined if mimetype didnt match (see fileFilter in app.js)
	if (!image) {
		return res.status(422).render('admin/edit-product', {
			pageTitle: 'Add Product',
			path: '/admin/add-product',
			editing: false,
			hasError: true,
			errorMessage: 'Attached file is not an image!',
			product: {
				title: title,
				price: price,
				description: description,
			},
			validationErrors: [],
		});
	}

	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		console.log(errors.array());
		return res.status(422).render('admin/edit-product', {
			pageTitle: 'Add Product',
			path: '/admin/add-product',
			editing: false,
			//when hasError is true, we wanna fill input fields with product data (as hasError will be true when validation gone wrong)
			hasError: true,
			errorMessage: errors.array()[0].msg,
			product: {
				title: title,
				price: price,
				description: description,
			},
			validationErrors: errors.array(),
		});
	}

	//path to image
	// console.log('imagePath: ', image.path);
	const imageUrl = image.path;

	//* Mongoose queries are not promises. They have a .then() function for co and async/await as a convenience. If you need a fully-fledged promise, use the .exec() function.
	const product = new Product({
		title: title,
		price: price,
		description: description,
		imageUrl: imageUrl,
		// userId: req.user._id,
		//*we can even just pass full user, as userId is defined as an ObjectId, it'll pick just the _id from user automatically
		userId: req.user,
	});

	product
		//mongoose save() method
		.save()
		.then((result) => {
			console.log('created Product');
			res.redirect('/admin/products');
		})
		.catch((err) => {
			// console.log('err in save() in admin.js:', err);
			//*if we're here it means some technical error happened
			// res.redirect('/500');
			//*but there are many catch blocks everwhere where technical errors can happen, and we dont want to replicate code, instead we will throw an error
			// console.log(err);
			const error = new Error(err);
			//*our own attribute httpStatusCode, see err handling middleware for explanation why sending this
			error.httpStatusCode = 500;
			//*when we call next with an error passed in arg, then express will skip all other middlewares and go directly to an error handling middleware
			return next(error);

			//can refactor this code too..
		});
};

exports.getEditProduct = (req, res, next) => {
	//*only when edit is set somewhere in query params in the url, we'll get its value as string in editMode (so a string "true"). If its not set, we'll get undefined (which is treated as false in a boolean check)
	const editMode = req.query.edit;
	if (!editMode) {
		return res.redirect('/');
	}
	//getting productId from the url
	const prodId = req.params.productId;

	//mongoose static findById()
	Product.findById(prodId)
		.then((product) => {
			//*if no id matches, product receives undefined, and we need to return error page. In vid index page returned
			//*could actually re render admin products page and flash a msg
			if (!product) {
				return errorController.get404(req, res, next);
			}

			res.render('admin/edit-product', {
				pageTitle: 'Edit Product',
				path: '/admin/edit-product',
				editing: editMode,
				product: product,
				hasError: false,
				errorMessage: null,
				validationErrors: [],
				_id: prodId,
			});
		})
		.catch((err) => {
			// console.log('err in findById in admin.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

//now editing only those prods created by logged in user
exports.postEditProduct = (req, res, next) => {
	const prodId = req.body.productId;
	const updatedTitle = req.body.title;
	const updatedPrice = req.body.price;
	const image = req.file;
	const updatedDescription = req.body.description;
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		console.log(errors.array());
		return res.status(422).render('admin/edit-product', {
			pageTitle: 'Edit Product',
			path: '/admin/edit-product',
			editing: true,
			hasError: true,
			errorMessage: errors.array()[0].msg,
			product: {
				title: updatedTitle,
				price: updatedPrice,
				description: updatedDescription,
				_id: prodId,
			},
			validationErrors: errors.array(),
		});
	}

	Product.findById(prodId)
		.then((product) => {
			if (product.userId.toString() !== req.user._id.toString()) {
				console.log('Editing the product not allowed');
				return res.redirect('/');
			}
			//*product is not a js obj with just data, but its mongoose obj (doc) with all mongoose methods
			product.title = updatedTitle;
			product.price = updatedPrice;
			product.description = updatedDescription;
			//*only updating imageUrl if a new image is set when editing
			if (image) {
				//*not waiting for this to complete (fire and forget)
				fileHelper.deleteFile(product.imageUrl);
				product.imageUrl = image.path;
			}
			//*When we call save() on an existing mongoose obj (which exists in db), it'll automatically update the existing one in db, not add a new document
			return product.save().then((result) => {
				//*nested then block's error is also handled in outside catch block!
				// throw new Error('hello');
				console.log('Updated the Product!');
				//* if we do have an err, we wont get redirected.. we'll learn how to deal with this later
				res.redirect('/admin/products');
			});
		})

		.catch((err) => {
			// console.log(err);
			// console.log('err in save in admin.js', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

//now, will only show products created by the logged in user here (only showing isnt sufficient tho, added protection in edit and dlt prod too so one cant do it using dev tools or url)
exports.getProducts = (req, res, next) => {
	//only getting products made my currently logged in user
	Product.find({ userId: req.user._id })

		//we dont need these commented features here, but just for knowledge
		// //*if we need to get only some fields, we could attach select. We can even get all fields excluding some, like select(-name). _id will always be retrieved unless explicitly excluded
		//* .select('title price -id')
		// //*if we want to get all user related data, and not just the userId in products, instead of writing nested queries, we attach populate('path-to-populate'), in our case just the userId attrib (we can also pass nested paths if we had one, like userId.cart._id ...)
		// //*2nd argument is getting only some fields, same as select()
		//*ALSO, Population does not occur unless a callback is passed or execPopulate() is called if called on a document. The result of Product.find() is a query and not a document so you can call .populate() on it right away.
		//* .populate('userId', 'name email')
		.then((products) => {
			res.render('admin/products', {
				prods: products,
				pageTitle: 'Admin Products',
				path: '/admin/products',
			});
		})
		.catch((err) => {
			// console.log('err in find in admin js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

//now dlting products created by logged in user only
// exports.postDeleteProduct = (req, res, next) => {
// 	const prodId = req.body.productId;

// 	Product.findById(prodId)
// 		.then((product) => {
// 			if (!product) {
// 				return next(new Error('Product not found!'));
// 			}
// 			fileHelper.deleteFile(product.imageUrl);
// 			//mongoose static method deleteOne
// 			return Product.deleteOne({ _id: prodId, userId: req.user._id });
// 		})
// 		// .catch((err) => {
// 		// 	//could do it this way too... then whats use of old way??
// 		// 	next(err);
// 		// });
// 		.then((result) => {
// 			if (result.deletedCount > 0) {
// 				console.log('Destroyed the Product');
// 				return req.user.removeFromCart(prodId).then(() => {
// 					console.log('Removed Product from cart');
// 					res.redirect('/admin/products');
// 				});
// 			}

// 			console.log('Deleting the product not allowed');
// 			res.redirect('/admin/products');
// 		})
// 		.catch((err) => {
// 			// console.log('err in deleteOne() in admin.js:', err);
// 			const error = new Error(err);
// 			error.httpStatusCode = 500;
// 			return next(error);
// 		});
// };

exports.DeleteProduct = (req, res, next) => {
	//we are sending delete http request and then calling this control, and these requests dont have req.body
	const prodId = req.params.productId;

	Product.findById(prodId)
		.then((product) => {
			if (!product) {
				return next(new Error('Product not found!'));
			}
			fileHelper.deleteFile(product.imageUrl);
			//mongoose static method deleteOne
			return Product.deleteOne({ _id: prodId, userId: req.user._id });
		})
		// .catch((err) => {
		// 	//could do it this way too... then whats use of old way??
		// 	next(err);
		// });
		.then((result) => {
			if (result.deletedCount > 0) {
				console.log('Destroyed the Product');
				return req.user.removeFromCart(prodId).then(() => {
					console.log('Removed Product from cart');
 					//res.redirect('/admin/products');
					//express json function, pass js obj, it will be converted to json
					res.status(200).json({
						message: 'Success! Product Deleted',
					});
				});
			}

			res.status(403).json({
				message: 'You are not authorised to delete the product!',
			});
			console.log('Deleting the product not allowed');
			// res.redirect('/admin/products');
		})
		.catch((err) => {
			res.status(500).json({ message: 'Deleting the product failed!' });
		});
};
