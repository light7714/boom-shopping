const deleteProduct = (btn) => {
	const prodId = btn.parentNode.querySelector('[name=productId]').value;
	const csrf = btn.parentNode.querySelector('[name=_csrf]').value;

	//gives closest ancestor, the product card is an article
	const productElement = btn.closest('article');

	//fetch (fetch API) is supported by browser for sending http reqs (for fetching and sending data both)
	//(remember, can set a req body in delete requests)
	//we're not sending any json data (as it has no body), if we did send, then we'll have to parse json data received on backend
	//by default sending request to same server
	fetch('/admin/product/' + prodId, {
        //default method is get
		method: 'DELETE',
		//csrf looks for csrf token in body, query params and headers (in body it looks for _csrf name, it headers for csrf-token header)
		headers: {
			'csrf-token': csrf,
		},
	})
		.then((result) => {
			// console.log(result);
            //this method also waits fro teh whole body to be stream
			return result.json();
		})
		.then((data) => {
            //this is the data (message) sent by the server
			console.log(data);
			// productElement.remove(); //wont work in IE
			productElement.parentNode.removeChild(productElement);
		})
		.catch((err) => {
			console.log('err in fetch:', err);
		});
};
