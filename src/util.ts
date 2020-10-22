/** promisified setTimeout */
export function pDelay<T = undefined>(delay = 1, arg?: T): Promise<T> {
    return new Promise<T>((resolve) => {
        setTimeout(resolve, delay, arg);
    });
}
