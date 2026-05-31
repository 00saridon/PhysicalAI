export function parseLogLevel(line) {
    if (line.includes('[WARN]') || line.includes('Warning'))
        return 'WARN';
    if (line.includes('[ERROR]') || line.includes('Error'))
        return 'ERROR';
    if (line.includes('[RL]'))
        return 'RL';
    if (line.includes('[IL]'))
        return 'IL';
    if (line.includes('[INFO]'))
        return 'INFO';
    return 'RAW';
}
