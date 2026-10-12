import assert from 'assert';
import axios from '../../../index.js';
import formDataToJSON from '../../../lib/helpers/formDataToJSON.js';
import AxiosError from '../../../lib/core/AxiosError.js';

describe('helpers::formDataToJSON depth limit', function () {
  before(function () {
    // formDataToJSON relies on the spec-compliant FormData entries() iterator,
    // which is only available as a global on Node.js 18+.
    if (typeof FormData !== 'function') {
      this.skip();
    }
  });

  it('should throw AxiosError when a field path exceeds the default depth limit', function () {
    const formData = new FormData();

    formData.append('foo' + '[bar]'.repeat(101), '123');

    let thrown;

    try {
      formDataToJSON(formData);
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown, 'Should have thrown');
    assert.ok(thrown instanceof AxiosError, 'error must be AxiosError');
    assert.strictEqual(thrown.code, AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED);
    assert.strictEqual(thrown.code, 'ERR_FORM_DATA_DEPTH_EXCEEDED');
    assert.ok(!(thrown instanceof RangeError));
  });

  it('should throw AxiosError while tokenizing very deep field paths', function () {
    const formData = new FormData();

    formData.append('foo' + '[bar]'.repeat(10000), '123');

    let thrown;

    try {
      formDataToJSON(formData);
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown, 'Should have thrown');
    assert.ok(thrown instanceof AxiosError, 'error must be AxiosError');
    assert.strictEqual(thrown.code, AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED);
    assert.ok(!(thrown instanceof RangeError));
  });

  it('should convert a field path at the default depth limit', function () {
    const formData = new FormData();

    formData.append('foo' + '[bar]'.repeat(100), '123');

    let value = formDataToJSON(formData).foo;

    for (let i = 0; i < 100; i++) {
      value = value.bar;
    }

    assert.strictEqual(value, '123');
  });

  it('should not crash axios.formToJSON with the advisory deep-key payload', function () {
    const formData = new FormData();

    formData.append('a' + '[x]'.repeat(15000), 'value');

    let thrown;

    try {
      axios.formToJSON(formData);
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown, 'Should have thrown');
    assert.ok(thrown instanceof AxiosError, 'error must be AxiosError, not ' + (thrown && thrown.name));
    assert.strictEqual(thrown.code, 'ERR_FORM_DATA_DEPTH_EXCEEDED');
  });

  it('should reject deeply nested field paths before adapter dispatch', async function () {
    const data = new FormData();
    let adapterCalled = false;

    data.append('foo' + '[bar]'.repeat(101), '123');

    let thrown;

    try {
      await axios.post('/test', data, {
        headers: {'Content-Type': 'application/json'},
        adapter(adapterConfig) {
          adapterCalled = true;
          return Promise.resolve({
            data: null,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: adapterConfig,
            request: {}
          });
        }
      });
    } catch (e) {
      thrown = e;
    }

    assert.ok(thrown instanceof AxiosError, 'must be AxiosError');
    assert.strictEqual(thrown.code, AxiosError.ERR_FORM_DATA_DEPTH_EXCEEDED);
    assert.strictEqual(adapterCalled, false);
  });

  it('should still convert ordinary nested FormData to JSON', function () {
    const formData = new FormData();

    formData.append('foo[bar][baz]', '1');
    formData.append('foo[qux][]', '2');
    formData.append('foo[qux][]', '3');

    assert.deepStrictEqual(formDataToJSON(formData), {
      foo: {
        bar: {baz: '1'},
        qux: ['2', '3']
      }
    });
  });
});
