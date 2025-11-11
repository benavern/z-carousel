export const debounce = (cb: Function, delay: number = 1000) => {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            cb(...args);
        }, delay);
    };
};

export const clamp = (nb: number, { min = -Infinity, max = Infinity }) => {
    return Math.max(min, Math.min(Number(nb) || min, max));
}
