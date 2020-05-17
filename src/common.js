export function log(msg) {
    if (msg instanceof Error) {
        console.error(`${msg.message}:\n${msg.stack}`);
    } else {
        console.trace(msg);
    }
}
