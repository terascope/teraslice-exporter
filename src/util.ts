/** promisified setTimeout */
export function pDelay<T = undefined>(delay = 1, arg?: T): Promise<T> {
    return new Promise<T>((resolve) => {
        setTimeout(resolve, delay, arg);
    });
}

export function extractVersionFromImageTag(image: string) {
    let version = '';

    if (image.includes(':')) {
        version = image.split(':')[1].split('_')[0];
    }

    return version;
}
