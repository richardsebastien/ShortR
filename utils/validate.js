const codeRegex = /^[A-Za-z0-9_-]{4,32}$/;


export function isValidUrl(u) {
try {
	// Use the URL constructor which correctly parses according to the WHATWG URL spec.
	// This is more reliable than a hand-rolled regex for typical https/http URLs.
	const parsed = new URL(u);
	return ["http:", "https:"].includes(parsed.protocol);
} catch {
return false;
}
}


export function isValidCode(code) {
return codeRegex.test(code);
}