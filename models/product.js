//right now adding product without linking user

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

//*MongoDb is schemaless, but here we're defining schemas. We're doing this as we often have a certain structure with the data we work with, and mongoose offers us advantage of just focussing on our data and not on queries, but for that it needs to know how the data looks like. But we can still deviate after setting schema and not set certain attributes in an object later (if required flag is not false)

//* _id will still be added automatically, another attribute __v (version key) is also added
//This is just a schema, not the product Model
const productSchema = new Schema({
	title: {
		type: String,
		required: true,
	},
	price: {
		type: Number,
		required: true,
	},
	description: {
		type: String,
		required: true,
	},
	imageUrl: {
		type: String,
		required: true,
	},
	//*we are refering this field to a user doc in the user model, so adding ref with model name we wanna reference (it could be any ObjectId, we need to let mongoose know what we're referring to)
	userId: {
		type: Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
});

//to make an object from model in other files, syntax is: const product = new Product();
//*mongoose takes model name, converts to lower case. pluralises it and adds a collection with that name to the db
module.exports = mongoose.model('Product', productSchema);
