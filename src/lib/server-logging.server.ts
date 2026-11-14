// Framework exceptions can contain request data. Keep server error output content-free.
const writeError = console.error.bind(console);
console.error = () => writeError("Frontend rendering failed.");

export {};
