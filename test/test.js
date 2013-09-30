var assert = require("assert");
var basictemplate = require("../basictemplate");

var Context = BasicTemplate.Context;

describe('Context', function() {
	var context;

	beforeEach(function() {
		context = new Context({ 'id': 0, 'name': 'Jeferson', 'value':{'a':42, 'b': 93}});
	});

	it('is able to lookup simple properties', function() {
		assert.equal('Jeferson', context.lookup('name'));
	});

	it('is able to lookup child properties', function() {
		assert.equal(42, context.lookup('value.a'));
		assert.equal(93, context.lookup('value.b'));
	});

	it('should return empty string when value not exists', function() {
		assert.equal('', context.lookup('inexistent'));		
		assert.equal('', context.lookup('value.z'));
	});

	it('is able to lookup injected properties', function() {
		context.set('user', {'name': 'Daniel', 'age':13});
		assert.equal('Daniel', context.lookup('user.name'));
		assert.equal(13, context.lookup('user.age'));
	});
});

describe('BasicTemplate', function(){
	describe('#tokenize()', function(){
		it('should return [] when the string is empty', function() {
			assert.equal(0, BasicTemplate.tokenize('').length);
		});

		it('should raise an exception when are unclused {{if}} tag', function() {
			assert.throws(function() {
				BasicTemplate.tokenize('My name is {{if name}} prit');
			}, Error);
		});
	});

	describe('when compile template', function() {
		var data;

		beforeEach(function() {
			data = {
				'firstName': 'Duke',
				'secondName': 'Nukem',
				'client': true,
				'age': 30,
				'isOld': (function () { return this.age > 60; }),
				'fullName': (function() { return this.firstName + ' ' + this.secondName; }),
				'cards': [{'name': 'Card A'}, {'name': 'Card B'}, {'name': 'Card C'}]
			};
		});

		it('should replace simple properties', function() {
			assert.equal('Hello, my first name is Duke', BasicTemplate.compile('Hello, my first name is {{firstName}}', data));
			assert.equal('Duke', BasicTemplate.compile('{{firstName}}', data));
		});

		it('should replace function names with their result', function() {
			assert.equal('Hello, my first name is Duke Nukem', BasicTemplate.compile('Hello, my first name is {{fullName}}', data));
		});

		it('should process interpret if tag', function() {
			assert.equal('I am a client', BasicTemplate.compile('{{if client}}I am a client{{endif}}', data));
			assert.equal('I am young', BasicTemplate.compile('{{if !isOld}}I am young{{endif}}', data));
			assert.equal('Young', BasicTemplate.compile('{{if !isOld}}Young{{else}}Old{{endif}}', data));
		});

		it('should process interpret for tag', function() {
			assert.equal('<ul><li>Card A</li><li>Card B</li><li>Card C</li></ul>',
				BasicTemplate.compile('<ul>{{for card in cards}}<li>{{card.name}}</li>{{endfor}}</ul>', data));
		});
	});
});