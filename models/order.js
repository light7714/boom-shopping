//The orders collection will have all the orders ever done for each user

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const orderSchema = new Schema({
	//array of docs
	products: [
		{
			//*type is Object, as it'll be a full product doc embedded
			//*we should actually define the full product obj with all fields here too, but type: Object is just a shortcut, saying there can be just any obj
			product: {
				type: Object,
				required: true,
			},
			quantity: {
				type: Number,
				required: true,
			},
		},
	],
	user: {
		email: {
			type: String,
			required: true,
		},
		userId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
	},
});

module.exports = mongoose.model('Order', orderSchema);
