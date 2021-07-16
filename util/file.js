const fs = require('fs');

//will be used to dlt image on filesystem after editing prod with new image, or deleting the prod
const deleteFile = (filePath) => {
	fs.unlink(filePath, (err) => {
		if (err) {
			//error handling middleware will catch it
			throw err;
		}
	});
};

exports.deleteFile = deleteFile;
