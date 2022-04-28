import { extractVersionFromImageTag } from './util';

test('version can be extracted from image string', () => {
    expect(extractVersionFromImageTag('internal.terascope.io/teraslice:v0.70.0')).toBe('v0.70.0');
});

test('version can be extracted from image string with _ build tag', () => {
    expect(extractVersionFromImageTag('internal.terascope.io/teraslice:v0.70.0_12345')).toBe('v0.70.0');
});

test('empty string when image tag is omitted', () => {
    expect(extractVersionFromImageTag('internal.terascope.io/teraslice')).toBe('');
});
