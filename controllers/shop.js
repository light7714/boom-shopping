const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 2;

exports.getProducts = (req, res, next) => {
	const page = +req.query.page || 1;
	let totalItems;

	//mongoose static method find(), it returns all products instead of cursor. we can still get cursor by find().cursor()
	Product.find()
		.countDocuments()
		.then((numProducts) => {
			totalItems = numProducts;
			return Product.find()
				.skip((page - 1) * ITEMS_PER_PAGE)
				.limit(ITEMS_PER_PAGE);
		})
		.then((products) => {
			res.render('shop/product-list', {
				prods: products,
				pageTitle: 'Products',
				path: '/product-list',
				currentPage: page,
				hasNextPage: ITEMS_PER_PAGE * page < totalItems,
				hasPreviousPage: page > 1,
				nextPage: page + 1,
				previousPage: page - 1,
				lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
			});
		})
		.catch((err) => {
			// console.log('err in find() in shop.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

exports.getProduct = (req, res, next) => {
	//*productId was passed by the req as in the route, we handled it as :productId in url
	const prodId = req.params.productId;

	//mongoose static method findById()
	//passing prodId string here, mongoose will convert it to ObjectId
	Product.findById(prodId)
		.then((product) => {
			//*not in vid
			if (!product) {
				return errorController.get404(req, res, next);
			}
			res.render('shop/product-detail', {
				product: product,
				pageTitle: product.title,
				path: '/products',
			});
		})
		.catch((err) => {
			// console.log('err in findById in shop.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

exports.getIndex = (req, res, next) => {
	//we have query param page (1, 2, ..) embedded in links in view
	//means if req.query.page is not true, then page will be 1 (cus if user visits just /, then also 1st page should be shown)
	const page = +req.query.page || 1;
	let totalItems;

	//*we should ideally return cursor here..
	Product.find()
		.countDocuments()
		.then((numProducts) => {
			totalItems = numProducts;
			return (
				Product.find()
					//*mongodb (and mongoose) fn skip(x), it skips 1st x amount of results
					.skip((page - 1) * ITEMS_PER_PAGE)
					//*limits the amount of results (for eg on 2nd page 1st 2 items skipped, but we need only item 3 and 4, not more than that)
					.limit(ITEMS_PER_PAGE)
			);
		})
		.then((products) => {
			res.render('shop/index', {
				prods: products,
				pageTitle: 'Shop',
				path: '/',
				currentPage: page,
				//next page link on view will be there only when items are left
				hasNextPage: ITEMS_PER_PAGE * page < totalItems,
				hasPreviousPage: page > 1,
				//giving the view the next page number
				nextPage: page + 1,
				previousPage: page - 1,
				lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
			});
		})
		.catch((err) => {
			// console.log('err in find() in shop.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

exports.getCart = (req, res, next) => {
	req.user
		//*Population does not occur unless a callback is passed or execPopulate() is called if called on a document. req.user is a document so you must call execPopulate on it
		.populate('cart.items.productId')
		.execPopulate()
		//we'll get the full user obj, with populated fields
		.then((user) => {
			//*actually its not products, it contains some product data (productId: {all_product_attributes}, quantity:~)
			const products = user.cart.items;
			//*in the view, product data will be avlbl on productId field, like product.productId.title, but qty is on product.quantity only (see cart model in user model)
			res.render('shop/cart', {
				path: '/cart',
				pageTitle: 'Your cart',
				products: products,
			});
		})
		.catch((err) => {
			// console.log('err in getCart() in shop.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

exports.postCart = (req, res, next) => {
	const prodId = req.body.productId;
	Product.findById(prodId)
		.then((product) => {
			//returning addToCart as it returns a promise (chain) here, so we can attach a then block below this
			return req.user.addToCart(product);
		})
		.then((result) => {
			// console.log(result);
			res.redirect('/cart');
		})
		.catch((err) => {
			// console.log('err in findById in shop.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

//*rn its removing the product completely, even if qty > 1 (in vid also)
exports.postCartDeleteProduct = (req, res, next) => {
	const prodId = req.body.productId;
	req.user
		.removeFromCart(prodId)
		.then((result) => {
			res.redirect('/cart');
		})
		.catch((err) => {
			// console.log('err in removeFromCart() in shop.js:', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

exports.postOrder = (req, res, next) => {
	req.user
		.populate('cart.items.productId')
		.execPopulate()
		.then((user) => {
			//*actually user.cart.items was not products, it contains some product data (productId: {all_product_attributes}, quantity:~), thats why added map()
			const products = user.cart.items.map((i) => {
				//**actually if I just write i.productId, which contains all product data, also contains meta data mongoose added, and its somehow only storing the id in product field (due to too much meta data maybe..), if we want it to store just the data, we need to extract data from _doc (we cant see this behaviour in the console, as even in console it takes data from _doc behind the scenes) see link in README
				return {
					quantity: i.quantity,
					product: { ...i.productId._doc },
				};
			});

			const order = new Order({
				user: {
					email: req.user.email,
					userId: req.user,
				},
				products: products,
			});

			return order.save();
		})
		.then(() => {
			req.user.clearCart();
		})
		.then((result) => {
			res.redirect('/orders');
		})
		.catch((err) => {
			// console.log('err in populate() in shop.js (postOrder):', err);
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

exports.getOrders = (req, res, next) => {
	Order.find({ 'user.userId': req.user._id })
		.then((orders) => {
			res.render('shop/orders', {
				path: '/orders',
				pageTitle: 'Your Orders',
				orders: orders,
			});
		})
		.catch((err) => {
			// console.log('err in gerOrders() in getOrders in shop.js');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};
