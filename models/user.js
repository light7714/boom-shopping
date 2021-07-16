const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
	// name: {
	// 	type: String,
	// 	required: true,
	// },
	email: {
		type: String,
		required: true,
	},
	password: {
		type: String,
		required: true,
	},
	//next 2 attributes wont be passed always, they're not required (required only when resetting password)
	resetToken: String,
	resetTokenExpiration: Date,
	//cart will be embedded document, with array of more embedded documents
	cart: {
		//defining that items will be an array of documents
		//if we wanted array of strings, we can write items: [String]
		items: [
			{
				//*an _id will also be added, mongoose adds _id for sub documents as well
				//*we are refering this field to a product doc in the product model, so adding ref with model name we wanna reference (it could be any ObjectId, we need to let mongoose know what we're referring to)
				productId: {
					type: Schema.Types.ObjectId,
					ref: 'Product',
					required: true,
				},
				quantity: {
					type: Number,
					required: true,
				},
			},
		],
	},
});

//adding our own methods to the schema
//* it should not be arrow function, so that 'this' refers to the schema
//will be called on a user obj, with populated cart
userSchema.methods.addToCart = function (product) {
	//*we can use this.cart.items in this function as well, cuz 'this' is the schema, and schema has cart.items

	//js function findIndex: returns -1 if condn not satisfied
	//* product._id is treated as a string in JS, but actually it is not a string really, so used ObjectId method toString() for proper comparision
	const cartProductIndex = this.cart.items.findIndex((cp) => {
		return cp.productId.toString() === product._id.toString();
	});

	let newQuantity = 1;
	const updatedCartItems = [...this.cart.items];

	//product already exists in cart
	if (cartProductIndex >= 0) {
		newQuantity = this.cart.items[cartProductIndex].quantity + 1;
		updatedCartItems[cartProductIndex].quantity = newQuantity;
	}
	//product doesnt exist in cart
	else {
		updatedCartItems.push({
			// productId: new ObjectId(product._id),
			//mongoose will automatically convert string to ObjectId when saving
			productId: product._id,
			quantity: newQuantity,
		});
	}

	const UpdatedCart = {
		items: updatedCartItems,
	};
	this.cart = UpdatedCart;

	//promise returned by this will be handled in controller where addToCart() is called
	return this.save();
};

userSchema.methods.removeFromCart = function (productId) {
	//js filter method returns a new array with filtered items (all items which make it thru the filter). filter is a fn, runs on every item. return shud be true if we want to keep a particular item, else false.
	const updatedCartItems = this.cart.items.filter((item) => {
		return item.productId.toString() !== productId.toString();
	});

	this.cart.items = updatedCartItems;
	return this.save();
};

userSchema.methods.clearCart = function () {
	this.cart = { items: [] };
	return this.save();
};

//*mongoose takes model name, converts to lower case. pluralises it and adds a collection with that name to the db
module.exports = mongoose.model('User', userSchema);
