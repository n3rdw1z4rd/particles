export interface UrlParameters {
    [key: string]: string | number | boolean;
}

export function GetUrlParams(): UrlParameters {
    const urlParameters: UrlParameters = {};
    const params = new URLSearchParams(window.location.search);

    for (let [key, value] of params) {
        if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
            urlParameters[key] = (value === 'true') as boolean;
        } else if (value.includes('.') && !isNaN(parseFloat(value))) {
            urlParameters[key] = parseFloat(value) as number;
        } else if (!value.includes('.') && !isNaN(parseInt(value))) {
            urlParameters[key] = parseInt(value) as number;
        } else {
            urlParameters[key] = value as string;
        }
    }

    return urlParameters;
}