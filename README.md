BasicTemplate.js
================

Very small, easy-to-use and fast Javascript Template Engine. BasicTemplate.js is a logicless engine with no dependencies.

## Advantages
    Easy to learn and modify
    Very small (5kb only)
    Logicless
    Conditionals Structures
    Loop Structure
    CrossBrowser (IE 7+)

## Benchmark

You can compare BasicTemplate performance on: http://jsperf.com/dom-vs-innerhtml-based-templating/835

## Usage
BasicTemplate.js syntax is similar both mustache syntax as the BASIC language syntax. The engine works with the following self-descriptive tags: {{value}}, {{if value}}{{else}}{{endif}} {{for value in values}} {{endfor}}

### Variables
Code:

    var data = {
      'name': 'Jeferson'
    };
    BasicTemplate.compile('Hello, my name is {{name}}', data);
    
Output:

    Hello, my name is Jeferson
    
### Conditionals: if and else

Code:

    var data = {
      'textA': 'This must be printed',  
      'textB': 'This will not be printed',
      'print': true
    };
    BasicTemplate.compile('{{if print}} {{textA}} {{else}} {{textB}} {{endif}}', data);

Output:

    This must be printed
  
Code:

    var data = {
      'name': ''
    };
    BasicTemplate.compile('{{if !name}}I have no name{{endif}}', data);

Output:

    I have no name

### Iterator: for

Code:

    var data = {
      'cards': [{'name': 'Card A'}, {'name': 'Card B'}, {'name': 'Card C'}]
    };
    BasicTemplate.compile('<ul>{{for card in cards}}<li>{{card.name}}</li>{{endfor}}</ul>');

Output:

    <ul><li>Card A</li><li>Card B</li><li>Card C</li></ul>
