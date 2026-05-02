# Tests

Unit tests for plyr-video using [Vitest](https://vitest.dev/).

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

```
test/
├── providers/
│   ├── rutube.test.js      # Rutube provider tests
│   ├── yandex.test.js      # Yandex provider tests
│   ├── vk.test.js          # VK provider tests
│   └── mailru.test.js      # Mail.ru provider tests
```

## Adding New Tests

1. Create a new test file in `test/providers/` with `.test.js` extension
2. Use Vitest's `describe`, `it`, and `expect` functions
3. Run `npm test` to verify your tests pass

## Coverage Report

After running `npm run test:coverage`, open `coverage/index.html` in your browser to view the coverage report.
