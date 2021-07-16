const express = require('express');
const { body } = require('express-validator');

const adminController = require('../controllers/admin');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

//* /admin/add-product => GET
router.get('/add-product', isAuth, adminController.getAddProduct);

//* /admin/add-product => POST
router.post(
	'/add-product',
	[
		//*isAlphanumeric gives error on any whitespace, we dont want that, so using isString()
		body('title').isString().isLength({ min: 3 }).trim(),
		// body('imageUrl').isURL(),
		body('price').isFloat(),
		body('description').isLength({ min: 5, max: 400 }).trim(),
	],
	isAuth,
	adminController.postAddProduct
);

// * /admin/products => GET
router.get('/products', isAuth, adminController.getProducts);

//* /admin/edit-product => GET
router.get('/edit-product/:productId', isAuth, adminController.getEditProduct);

//* /admin/edit-product => POST
router.post(
	'/edit-product',
	[
		body('title').isString().isLength({ min: 3 }).trim(),
		// body('imageUrl').isURL(),
		body('price').isFloat(),
		body('description').isLength({ min: 5, max: 400 }).trim(),
	],
	isAuth,
	adminController.postEditProduct
);

//* /admin/delete-product => POST
// router.post('/delete-product', isAuth, adminController.postDeleteProduct);

//*When we do form submission, links, etc. then we can only do get and post request. but when we send req thru browser side js, we have access to other http methods.
//*its only a semantic thing, we could use post too. cuz in server side we can write any http method (not get...?) as we define what to do with it in server side (BUT delete requests dont have req.body)

//* /admin/product/:productId => DELETE
router.delete('/product/:productId', isAuth, adminController.DeleteProduct);

module.exports = router;
