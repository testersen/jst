# Testersen's JavaScript Templating Engine

_Or `@testersen/jst` for short._

JST is a simple, fast, and lightweight JavaScript templating engine that allows
you to execute JavaScript code in your text templates.

Unlike [Handlebars], [EJS], or [Pug], JST does not support fancy features like
partials, helpers, mixins or templating features like if/else, loops or filters.
It is a minimalistic templating engine that allows you to execute JavaScript
code in your templates.

There are varying levels of complexity in how you choose to integrate. You can
have a simple template string that you want to evaluate into a string, or you
can have a more complex template where you want to do pattern matching against
other strings, or optimistic matching against strings. You can think of JST as a
simple way to evaluate JavaScript code in your templates, similar to the
JavaScript template literals.

[Handlebars]: https://handlebarsjs.com/
[EJS]: https://ejs.co/
[Pug]: https://pugjs.org/
