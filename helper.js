const capitalizeFirstLetter = (inputString) => {
	if(typeof inputString == "string") {
		return inputString.charAt(0).toUpperCase() + inputString.slice(1);
	}
	else {
		return  inputString;
	}
}

const removeQuotes = (inputString) => {
	if(typeof inputString == "string") {
		return inputString.replace(/^"(.+)"$/,'$1');
	}
	else {
		return  inputString;
	}
}

const checkBool = (bool) => {
	return typeof bool === 'boolean' ||
		(typeof bool === 'object' &&
			bool !== null            &&
			typeof bool.value === 'boolean');
}

const getByValue = (map, searchValue) => {
	for (let [key, value] of map.entries()) {
		if (value === searchValue)
			return key;
	}
}

module.exports = {
	capitalizeFirstLetter,
	removeQuotes,
	checkBool,
	getByValue
}