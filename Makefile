TESTS = test/*.test.js
REPORTER = spec
TIMEOUT = 20000
PATH := ./node_modules/.bin:$(PATH)

test-cov:
	@nyc --reporter=html --reporter=text mocha -t $(TIMEOUT) -R spec $(TESTS)

test-coveralls:
	@npm run lint
	@nyc mocha -t $(TIMEOUT) -R spec $(TESTS)
	@echo TRAVIS_JOB_ID $(TRAVIS_JOB_ID)
	@nyc report --reporter=text-lcov | coveralls

doc:
	@doxmate build

.PHONY: test doc
