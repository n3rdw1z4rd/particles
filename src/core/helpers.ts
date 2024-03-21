export interface UrlParameters {
    [key: string]: string;
}

export function GetUrlParams(): UrlParameters {
    const urlParameters: UrlParameters = {};
    const params = new URLSearchParams(window.location.search);

    for (let param of params) {
        urlParameters[param[0]] = param[1];
    }

    return urlParameters;
}