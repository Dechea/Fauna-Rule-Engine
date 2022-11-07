const capitalizeFirstLetter = (inputString) => {
	if(typeof inputString == "string") {
		return inputString.charAt(0).toUpperCase() + inputString.slice(1);
	}
	else {
		return  inputString;
	}
}

const deCapitalizeFirstLetter = (inputString) => {
	if(typeof inputString == "string") {
		return inputString.charAt(0).toLowerCase() + inputString.slice(1);
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

const getMapKeyByValue = (map, searchValue) => {
	for (let [key, value] of map.entries()) {
		if (value === searchValue)
			return key;
	}
}

function getObjKeyByValue(obj, value) {
	return Object.keys(obj).find(key => obj[key] === value);
}

const isNumeric = (value) => {
	return /^\d+$/.test(value);
}

module.exports = {
	capitalizeFirstLetter,
	deCapitalizeFirstLetter,
	removeQuotes,
	checkBool,
	getMapKeyByValue,
	getObjKeyByValue,
	isNumeric
}