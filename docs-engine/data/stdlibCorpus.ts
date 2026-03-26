/**
 * Prebuilt stdlib documentation corpus.
 *
 * AUTO-GENERATED — do not edit manually.
 * Source: docs.python.org/3.13
 * Generated: 2026-03-24
 *
 * All content is from official Python documentation.
 * Regenerate with: npx tsx scripts/build-stdlib-corpus.ts
 */

export interface StdlibCorpusEntry {
    summary: string;
    content?: string;
    signature?: string;
    url: string;
    seeAlso?: string[];
}

export const STDLIB_CORPUS: Record<string, StdlibCorpusEntry> = {
  "None": {
    "summary": "An object frequently used to represent the absence of a value, as when default arguments are not passed to a function. Assignments to None are illegal and raise a SyntaxError . None is the sole instance of the NoneType type.",
    "content": "None\n\nAn object frequently used to represent the absence of a value, as when default arguments are not passed to a function. Assignments to None are illegal and raise a SyntaxError . None is the sole instance of the NoneType type.",
    "signature": "None",
    "url": "https://docs.python.org/3.13/library/constants.html#None"
  },
  "True": {
    "summary": "The true value of the bool type. Assignments to True are illegal and raise a SyntaxError .",
    "content": "True\n\nThe true value of the bool type. Assignments to True are illegal and raise a SyntaxError .",
    "signature": "True",
    "url": "https://docs.python.org/3.13/library/constants.html#True"
  },
  "False": {
    "summary": "The false value of the bool type. Assignments to False are illegal and raise a SyntaxError .",
    "content": "False\n\nThe false value of the bool type. Assignments to False are illegal and raise a SyntaxError .",
    "signature": "False",
    "url": "https://docs.python.org/3.13/library/constants.html#False"
  },
  "Ellipsis": {
    "summary": "The same as the ellipsis literal “ ... ”, an object frequently used to indicate that something is omitted. Assignment to Ellipsis is possible, but assignment to ... raises a SyntaxError . Ellipsis is the sole instance of the types.EllipsisType type.",
    "content": "Ellipsis\n\nThe same as the ellipsis literal “ ... ”, an object frequently used to indicate that something is omitted. Assignment to Ellipsis is possible, but assignment to ... raises a SyntaxError . Ellipsis is the sole instance of the types.EllipsisType type.",
    "signature": "Ellipsis",
    "url": "https://docs.python.org/3.13/library/constants.html#Ellipsis"
  },
  "NotImplemented": {
    "summary": "A special value which should be returned by the binary special methods (e.g. __eq__() , __lt__() , __add__() , __rsub__() , etc.) to indicate that the operation is not implemented with respect to the other type; may be returned by the in-place binary special methods (e.g. __imul__() , __iand__() , etc.) for the same purpose. It should not be evaluated in a boolean context. NotImplemented is the sole instance of the types.NotImplementedType type.",
    "content": "NotImplemented\n\nA special value which should be returned by the binary special methods (e.g. __eq__() , __lt__() , __add__() , __rsub__() , etc.) to indicate that the operation is not implemented with respect to the other type; may be returned by the in-place binary special methods (e.g. __imul__() , __iand__() , etc.) for the same purpose. It should not be evaluated in a boolean context. NotImplemented is the sole instance of the types.NotImplementedType type.\n\nWhen a binary (or in-place) method returns NotImplemented the interpreter will try the reflected operation on the other type (or some other fallback, depending on the operator). If all attempts return NotImplemented , the interpreter will raise an appropriate exception. Incorrectly returning NotImplemented will result in a misleading error message or the NotImplemented value being returned to Python code.\n\nSee Implementing the arithmetic operations for examples.",
    "signature": "NotImplemented",
    "url": "https://docs.python.org/3.13/library/constants.html#NotImplemented"
  },
  "__debug__": {
    "summary": "This constant is true if Python was not started with an -O option. See also the assert statement.",
    "content": "__debug__\n\nThis constant is true if Python was not started with an -O option. See also the assert statement.",
    "signature": "__debug__",
    "url": "https://docs.python.org/3.13/library/constants.html#debug__"
  },
  "assert": {
    "summary": "Assert statements are a convenient way to insert debugging assertions into a program:",
    "content": "**7.3. The assert statement**\n\nAssert statements are a convenient way to insert debugging assertions into a program:\n\nassert_stmt ::= \"assert\" expression [\",\" expression ] The simple form, assert expression , is equivalent to\n\nif __debug__ : if not expression : raise AssertionError The extended form, assert expression1, expression2 , is equivalent to\n\nif __debug__ : if not expression1 : raise AssertionError ( expression2 ) These equivalences assume that __debug__ and AssertionError refer to the built-in variables with those names. In the current implementation, the built-in variable __debug__ is True under normal circumstances, False when optimization is requested (command line option -O ). The current code generator emits no code for an assert statement when optimization is requested at compile time. Note that it is unnecessary to include the source code for the expression that failed in the error message; it will be displayed as part of the stack trace.\n\nAssignments to __debug__ are illegal. The value for the built-in variable is determined when the interpreter starts.",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-assert-statement"
  },
  "pass": {
    "summary": "pass_stmt ::= \"pass\" pass is a null operation — when it is executed, nothing happens. It is useful as a placeholder when a statement is required syntactically, but no code needs to be executed, for example:",
    "content": "**7.4. The pass statement**\n\npass_stmt ::= \"pass\" pass is a null operation — when it is executed, nothing happens. It is useful as a placeholder when a statement is required syntactically, but no code needs to be executed, for example:",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-pass-statement"
  },
  "del": {
    "summary": "del_stmt ::= \"del\" target_list Deletion is recursively defined very similar to the way assignment is defined. Rather than spelling it out in full details, here are some hints.",
    "content": "**7.5. The del statement**\n\ndel_stmt ::= \"del\" target_list Deletion is recursively defined very similar to the way assignment is defined. Rather than spelling it out in full details, here are some hints.\n\nDeletion of a target list recursively deletes each target, from left to right.\n\nDeletion of a name removes the binding of that name from the local or global namespace, depending on whether the name occurs in a global statement in the same code block. Trying to delete an unbound name raises a NameError exception.\n\nDeletion of attribute references, subscriptions and slicings is passed to the primary object involved; deletion of a slicing is in general equivalent to assignment of an empty slice of the right type (but even this is determined by the sliced object).\n\nChanged in version 3.2: Previously it was illegal to delete a name from the local namespace if it occurs as a free variable in a nested block.",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-del-statement"
  },
  "return": {
    "summary": "return_stmt ::= \"return\" [ expression_list ] return may only occur syntactically nested in a function definition, not within a nested class definition.",
    "content": "**7.6. The return statement**\n\nreturn_stmt ::= \"return\" [ expression_list ] return may only occur syntactically nested in a function definition, not within a nested class definition.\n\nIf an expression list is present, it is evaluated, else None is substituted.\n\nreturn leaves the current function call with the expression list (or None ) as return value.\n\nWhen return passes control out of a try statement with a finally clause, that finally clause is executed before really leaving the function.\n\nIn a generator function, the return statement indicates that the generator is done and will cause StopIteration to be raised. The returned value (if any) is used as an argument to construct StopIteration and becomes the StopIteration.value attribute.",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-return-statement"
  },
  "yield": {
    "summary": "yield_stmt ::= yield_expression A yield statement is semantically equivalent to a yield expression . The yield statement can be used to omit the parentheses that would otherwise be required in the equivalent yield expression statement. For example, the yield statements",
    "content": "**7.7. The yield statement**\n\nyield_stmt ::= yield_expression A yield statement is semantically equivalent to a yield expression . The yield statement can be used to omit the parentheses that would otherwise be required in the equivalent yield expression statement. For example, the yield statements\n\nyield < expr > yield from < expr > are equivalent to the yield expression statements\n\n( yield < expr > ) ( yield from < expr > ) Yield expressions and statements are only used when defining a generator function, and are only used in the body of the generator function. Using yield in a function definition is sufficient to cause that definition to create a generator function instead of a normal function.\n\nFor full details of yield semantics, refer to the Yield expressions section.",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-yield-statement"
  },
  "raise": {
    "summary": "raise_stmt ::= \"raise\" [ expression [\"from\" expression ]] If no expressions are present, raise re-raises the exception that is currently being handled, which is also known as the active exception .",
    "content": "**7.8. The raise statement**\n\nraise_stmt ::= \"raise\" [ expression [\"from\" expression ]] If no expressions are present, raise re-raises the exception that is currently being handled, which is also known as the active exception . If there isn’t currently an active exception, a RuntimeError exception is raised indicating that this is an error.\n\nOtherwise, raise evaluates the first expression as the exception object. It must be either a subclass or an instance of BaseException . If it is a class, the exception instance will be obtained when needed by instantiating the class with no arguments.\n\nThe type of the exception is the exception instance’s class, the value is the instance itself.\n\nA traceback object is normally created automatically when an exception is raised and attached to it as the __traceback__ attribute. You can create an exception and set your own traceback in one step using the with_traceback() exception method (which returns the same exception instance, with its traceback set to its argument), like so:\n\nraise Exception ( \"foo occurred\" ) . with_traceback ( tracebackobj ) The from clause is used for exception chaining: if given, the second expression must be another exception class or instance. If the second expression is an exception instance, it will be attached to the raised exception as the __cause__ attribute (which is writable). If the expression is an exception class, the class will be instantiated and the resulting exception instance will be attached to the…",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-raise-statement"
  },
  "break": {
    "summary": "break_stmt ::= \"break\" break may only occur syntactically nested in a for or while loop, but not nested in a function or class definition within that loop.",
    "content": "**7.9. The break statement**\n\nbreak_stmt ::= \"break\" break may only occur syntactically nested in a for or while loop, but not nested in a function or class definition within that loop.\n\nIt terminates the nearest enclosing loop, skipping the optional else clause if the loop has one.\n\nIf a for loop is terminated by break , the loop control target keeps its current value.\n\nWhen break passes control out of a try statement with a finally clause, that finally clause is executed before really leaving the loop.",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-break-statement"
  },
  "continue": {
    "summary": "continue_stmt ::= \"continue\" continue may only occur syntactically nested in a for or while loop, but not nested in a function or class definition within that loop. It continues with the next cycle of the nearest enclosing loop.",
    "content": "**7.10. The continue statement**\n\ncontinue_stmt ::= \"continue\" continue may only occur syntactically nested in a for or while loop, but not nested in a function or class definition within that loop. It continues with the next cycle of the nearest enclosing loop.\n\nWhen continue passes control out of a try statement with a finally clause, that finally clause is executed before really starting the next loop cycle.",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-continue-statement"
  },
  "import": {
    "summary": "import_stmt ::= \"import\" module [\"as\" identifier ] (\",\" module [\"as\" identifier ])* | \"from\" relative_module \"import\" identifier [\"as\" identifier ] (\",\" identifier [\"as\" identifier ])* | \"from\" relative_module \"import\" \"(\" identifier [\"as\" identifier ] (\",\" identifier [\"as\" identifier ])* [\",\"] \")\" | \"from\" relative_module \"import\" \"*\" module ::= ( identifier \".\")* identifier relative_module ::= \".\"* module | \".\"+ The basic import statement (no from clause) is executed in two steps:",
    "content": "**7.11. The import statement**\n\nimport_stmt ::= \"import\" module [\"as\" identifier ] (\",\" module [\"as\" identifier ])* | \"from\" relative_module \"import\" identifier [\"as\" identifier ] (\",\" identifier [\"as\" identifier ])* | \"from\" relative_module \"import\" \"(\" identifier [\"as\" identifier ] (\",\" identifier [\"as\" identifier ])* [\",\"] \")\" | \"from\" relative_module \"import\" \"*\" module ::= ( identifier \".\")* identifier relative_module ::= \".\"* module | \".\"+ The basic import statement (no from clause) is executed in two steps:\n\nfind a module, loading and initializing it if necessary\n\ndefine a name or names in the local namespace for the scope where the import statement occurs.\n\nWhen the statement contains multiple clauses (separated by commas) the two steps are carried out separately for each clause, just as though the clauses had been separated out into individual import statements.\n\nThe details of the first step, finding and loading modules, are described in greater detail in the section on the import system , which also describes the various types of packages and modules that can be imported, as well as all the hooks that can be used to customize the import system. Note that failures in this step may indicate either that the module could not be located, or that an error occurred while initializing the module, which includes execution of the module’s code.",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-import-statement"
  },
  "global": {
    "summary": "global_stmt ::= \"global\" identifier (\",\" identifier )* The global statement causes the listed identifiers to be interpreted as globals. It would be impossible to assign to a global variable without global , although free variables may refer to globals without being declared global.",
    "content": "**7.12. The global statement**\n\nglobal_stmt ::= \"global\" identifier (\",\" identifier )* The global statement causes the listed identifiers to be interpreted as globals. It would be impossible to assign to a global variable without global , although free variables may refer to globals without being declared global.\n\nThe global statement applies to the entire current scope (module, function body or class definition). A SyntaxError is raised if a variable is used or assigned to prior to its global declaration in the scope.\n\nAt the module level, all variables are global, so a global statement has no effect. However, variables must still not be used or assigned to prior to their global declaration. This requirement is relaxed in the interactive prompt ( REPL ).\n\nProgrammer’s note: global is a directive to the parser. It applies only to code parsed at the same time as the global statement. In particular, a global statement contained in a string or code object supplied to the built-in exec() function does not affect the code block containing the function call, and code contained in such a string is unaffected by global statements in the code containing the function call. The same applies to the eval() and compile() functions.",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-global-statement"
  },
  "nonlocal": {
    "summary": "nonlocal_stmt ::= \"nonlocal\" identifier (\",\" identifier )* When the definition of a function or class is nested (enclosed) within the definitions of other functions, its nonlocal scopes are the local scopes of the enclosing functions.",
    "content": "**7.13. The nonlocal statement**\n\nnonlocal_stmt ::= \"nonlocal\" identifier (\",\" identifier )* When the definition of a function or class is nested (enclosed) within the definitions of other functions, its nonlocal scopes are the local scopes of the enclosing functions. The nonlocal statement causes the listed identifiers to refer to names previously bound in nonlocal scopes. It allows encapsulated code to rebind such nonlocal identifiers. If a name is bound in more than one nonlocal scope, the nearest binding is used. If a name is not bound in any nonlocal scope, or if there is no nonlocal scope, a SyntaxError is raised.\n\nThe nonlocal statement applies to the entire scope of a function or class body. A SyntaxError is raised if a variable is used or assigned to prior to its nonlocal declaration in the scope.\n\nThe specification for the nonlocal statement.\n\nProgrammer’s note: nonlocal is a directive to the parser and applies only to code parsed along with it. See the note for the global statement.",
    "url": "https://docs.python.org/3.13/reference/simple_stmts.html#the-nonlocal-statement"
  },
  "if": {
    "summary": "The if statement is used for conditional execution:",
    "content": "**8.1. The if statement**\n\nThe if statement is used for conditional execution:\n\nif_stmt ::= \"if\" assignment_expression \":\" suite (\"elif\" assignment_expression \":\" suite )* [\"else\" \":\" suite ] It selects exactly one of the suites by evaluating the expressions one by one until one is found to be true (see section Boolean operations for the definition of true and false); then that suite is executed (and no other part of the if statement is executed or evaluated). If all expressions are false, the suite of the else clause, if present, is executed.",
    "url": "https://docs.python.org/3.13/reference/compound_stmts.html#the-if-statement"
  },
  "for": {
    "summary": "The for statement is used to iterate over the elements of a sequence (such as a string, tuple or list) or other iterable object:",
    "content": "**8.3. The for statement**\n\nThe for statement is used to iterate over the elements of a sequence (such as a string, tuple or list) or other iterable object:\n\nfor_stmt ::= \"for\" target_list \"in\" `!starred_list` \":\" suite [\"else\" \":\" suite ] The starred_list expression is evaluated once; it should yield an iterable object. An iterator is created for that iterable. The first item provided by the iterator is then assigned to the target list using the standard rules for assignments (see Assignment statements ), and the suite is executed. This repeats for each item provided by the iterator. When the iterator is exhausted, the suite in the else clause, if present, is executed, and the loop terminates.\n\nA break statement executed in the first suite terminates the loop without executing the else clause’s suite. A continue statement executed in the first suite skips the rest of the suite and continues with the next item, or with the else clause if there is no next item.\n\nThe for-loop makes assignments to the variables in the target list. This overwrites all previous assignments to those variables including those made in the suite of the for-loop:\n\nfor i in range ( 10 ): print ( i ) i = 5 # this will not affect the for-loop # because i will be overwritten with the next # index in the range Names in the target list are not deleted when the loop is finished, but if the sequence is empty, they will not have been assigned to at all by the loop. Hint: the built-in type range() represents imm…",
    "url": "https://docs.python.org/3.13/reference/compound_stmts.html#the-for-statement"
  },
  "while": {
    "summary": "The while statement is used for repeated execution as long as an expression is true:",
    "content": "**8.2. The while statement**\n\nThe while statement is used for repeated execution as long as an expression is true:\n\nwhile_stmt ::= \"while\" assignment_expression \":\" suite [\"else\" \":\" suite ] This repeatedly tests the expression and, if it is true, executes the first suite; if the expression is false (which may be the first time it is tested) the suite of the else clause, if present, is executed and the loop terminates.\n\nA break statement executed in the first suite terminates the loop without executing the else clause’s suite. A continue statement executed in the first suite skips the rest of the suite and goes back to testing the expression.",
    "url": "https://docs.python.org/3.13/reference/compound_stmts.html#the-while-statement"
  },
  "try": {
    "summary": "The try statement specifies exception handlers and/or cleanup code for a group of statements:",
    "content": "**8.4. The try statement**\n\nThe try statement specifies exception handlers and/or cleanup code for a group of statements:\n\ntry_stmt ::= try1_stmt | try2_stmt | try3_stmt try1_stmt ::= \"try\" \":\" suite (\"except\" [ expression [\"as\" identifier ]] \":\" suite )+ [\"else\" \":\" suite ] [\"finally\" \":\" suite ] try2_stmt ::= \"try\" \":\" suite (\"except\" \"*\" expression [\"as\" identifier ] \":\" suite )+ [\"else\" \":\" suite ] [\"finally\" \":\" suite ] try3_stmt ::= \"try\" \":\" suite \"finally\" \":\" suite Additional information on exceptions can be found in section Exceptions , and information on using the raise statement to generate exceptions may be found in section The raise statement .\n\nThe except clause(s) specify one or more exception handlers. When no exception occurs in the try clause, no exception handler is executed. When an exception occurs in the try suite, a search for an exception handler is started. This search inspects the except clauses in turn until one is found that matches the exception. An expression-less except clause, if present, must be last; it matches any exception.\n\nFor an except clause with an expression, the expression must evaluate to an exception type or a tuple of exception types. The raised exception matches an except clause whose expression evaluates to the class or a non-virtual base class of the exception object, or to a tuple that contains such a class.\n\nIf no except clause matches the exception, the search for an exception handler continues in the surrounding code and o…",
    "url": "https://docs.python.org/3.13/reference/compound_stmts.html#the-try-statement"
  },
  "with": {
    "summary": "The with statement is used to wrap the execution of a block with methods defined by a context manager (see section With Statement Context Managers ). This allows common try … except … finally usage patterns to be encapsulated for convenient reuse.",
    "content": "**8.5. The with statement**\n\nThe with statement is used to wrap the execution of a block with methods defined by a context manager (see section With Statement Context Managers ). This allows common try … except … finally usage patterns to be encapsulated for convenient reuse.\n\nwith_stmt ::= \"with\" ( \"(\" with_stmt_contents \",\"? \")\" | with_stmt_contents ) \":\" suite with_stmt_contents ::= with_item (\",\" with_item )* with_item ::= expression [\"as\" target ] The execution of the with statement with one “item” proceeds as follows:\n\nThe context expression (the expression given in the with_item ) is evaluated to obtain a context manager.\n\nThe context manager’s __enter__() is loaded for later use.\n\nThe context manager’s __exit__() is loaded for later use.",
    "url": "https://docs.python.org/3.13/reference/compound_stmts.html#the-with-statement"
  },
  "match": {
    "summary": "The match statement is used for pattern matching. Syntax:",
    "content": "**8.6. The match statement**\n\nAdded in version 3.10.\n\nThe match statement is used for pattern matching. Syntax:\n\nmatch_stmt ::= 'match' subject_expr \":\" NEWLINE INDENT case_block + DEDENT subject_expr ::= `!star_named_expression` \",\" `!star_named_expressions`? | `!named_expression` case_block ::= 'case' patterns [ guard ] \":\" `!block` Note\n\nThis section uses single quotes to denote soft keywords .\n\nPattern matching takes a pattern as input (following case ) and a subject value (following match ). The pattern (which may contain subpatterns) is matched against the subject value. The outcomes are:",
    "url": "https://docs.python.org/3.13/reference/compound_stmts.html#the-match-statement"
  },
  "case": {
    "summary": "The match statement is used for pattern matching. Syntax:",
    "content": "**8.6. The match statement**\n\nAdded in version 3.10.\n\nThe match statement is used for pattern matching. Syntax:\n\nmatch_stmt ::= 'match' subject_expr \":\" NEWLINE INDENT case_block + DEDENT subject_expr ::= `!star_named_expression` \",\" `!star_named_expressions`? | `!named_expression` case_block ::= 'case' patterns [ guard ] \":\" `!block` Note\n\nThis section uses single quotes to denote soft keywords .\n\nPattern matching takes a pattern as input (following case ) and a subject value (following match ). The pattern (which may contain subpatterns) is matched against the subject value. The outcomes are:",
    "url": "https://docs.python.org/3.13/reference/compound_stmts.html#the-match-statement"
  },
  "class": {
    "summary": "A class definition defines a class object (see section The standard type hierarchy ):",
    "content": "**8.8. Class definitions**\n\nA class definition defines a class object (see section The standard type hierarchy ):\n\nclassdef ::= [ decorators ] \"class\" classname [ type_params ] [ inheritance ] \":\" suite inheritance ::= \"(\" [ argument_list ] \")\" classname ::= identifier A class definition is an executable statement. The inheritance list usually gives a list of base classes (see Metaclasses for more advanced uses), so each item in the list should evaluate to a class object which allows subclassing. Classes without an inheritance list inherit, by default, from the base class object ; hence,\n\nclass Foo : pass is equivalent to\n\nclass Foo ( object ): pass The class’s suite is then executed in a new execution frame (see Naming and binding ), using a newly created local namespace and the original global namespace. (Usually, the suite contains mostly function definitions.) When the class’s suite finishes execution, its execution frame is discarded but its local namespace is saved. [ 5 ] A class object is then created using the inheritance list for the base classes and the saved local namespace for the attribute dictionary. The class name is bound to this class object in the original local namespace.\n\nThe order in which attributes are defined in the class body is preserved in the new class’s __dict__ . Note that this is reliable only right after the class is created and only for classes that were defined using the definition syntax.",
    "url": "https://docs.python.org/3.13/reference/compound_stmts.html#class-definitions"
  },
  "def": {
    "summary": "A function definition defines a user-defined function object (see section The standard type hierarchy ):",
    "content": "**8.7. Function definitions**\n\nA function definition defines a user-defined function object (see section The standard type hierarchy ):\n\nfuncdef ::= [ decorators ] \"def\" funcname [ type_params ] \"(\" [ parameter_list ] \")\" [\"->\" expression ] \":\" suite decorators ::= decorator + decorator ::= \"@\" assignment_expression NEWLINE parameter_list ::= defparameter (\",\" defparameter )* \",\" \"/\" [\",\" [ parameter_list_no_posonly ]] | parameter_list_no_posonly parameter_list_no_posonly ::= defparameter (\",\" defparameter )* [\",\" [ parameter_list_starargs ]] | parameter_list_starargs parameter_list_starargs ::= \"*\" [ star_parameter ] (\",\" defparameter )* [\",\" [ parameter_star_kwargs ]] | \"*\" (\",\" defparameter )+ [\",\" [ parameter_star_kwargs ]] | parameter_star_kwargs parameter_star_kwargs ::= \"**\" parameter [\",\"] parameter ::= identifier [\":\" expression ] star_parameter ::= identifier [\":\" [\"*\"] expression ] defparameter ::= parameter [\"=\" expression ] funcname ::= identifier A function definition is an executable statement. Its execution binds the function name in the current local namespace to a function object (a wrapper around the executable code for the function). This function object contains a reference to the current global namespace as the global namespace to be used when the function is called.\n\nThe function definition does not execute the function body; this gets executed only when the function is called. [ 4 ]\n\nA function definition may be wrapped by one or more decorator express…",
    "url": "https://docs.python.org/3.13/reference/compound_stmts.html#function-definitions"
  },
  "async": {
    "summary": "async_funcdef ::= [ decorators ] \"async\" \"def\" funcname \"(\" [ parameter_list ] \")\" [\"->\" expression ] \":\" suite Execution of Python coroutines can be suspended and resumed at many points (see coroutine ).",
    "content": "**8.9. Coroutines**\n\nAdded in version 3.5.\n\nasync_funcdef ::= [ decorators ] \"async\" \"def\" funcname \"(\" [ parameter_list ] \")\" [\"->\" expression ] \":\" suite Execution of Python coroutines can be suspended and resumed at many points (see coroutine ). await expressions, async for and async with can only be used in the body of a coroutine function.\n\nFunctions defined with async def syntax are always coroutine functions, even if they do not contain await or async keywords.\n\nIt is a SyntaxError to use a yield from expression inside the body of a coroutine function.\n\nAn example of a coroutine function:",
    "url": "https://docs.python.org/3.13/reference/compound_stmts.html#coroutines"
  },
  "abs": {
    "summary": "Return the absolute value of a number. The argument may be an integer, a floating-point number, or an object implementing __abs__() . If the argument is a complex number, its magnitude is returned.",
    "content": "abs ( number , / )\n\nReturn the absolute value of a number. The argument may be an integer, a floating-point number, or an object implementing __abs__() . If the argument is a complex number, its magnitude is returned.",
    "signature": "abs ( number , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#abs"
  },
  "all": {
    "summary": "Return True if all elements of the iterable are true (or if the iterable is empty). Equivalent to:",
    "content": "all ( iterable , / )\n\nReturn True if all elements of the iterable are true (or if the iterable is empty). Equivalent to:\n\n```python\ndef all ( iterable ): for element in iterable : if not element : return False return True\n```",
    "signature": "all ( iterable , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#all"
  },
  "any": {
    "summary": "Return True if any element of the iterable is true. If the iterable is empty, return False . Equivalent to:",
    "content": "any ( iterable , / )\n\nReturn True if any element of the iterable is true. If the iterable is empty, return False . Equivalent to:\n\n```python\ndef any ( iterable ): for element in iterable : if element : return True return False\n```",
    "signature": "any ( iterable , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#any"
  },
  "ascii": {
    "summary": "As repr() , return a string containing a printable representation of an object, but escape the non-ASCII characters in the string returned by repr() using \\x , \\u , or \\U escapes. This generates a string similar to that returned by repr() in Python 2.",
    "content": "ascii ( object , / )\n\nAs repr() , return a string containing a printable representation of an object, but escape the non-ASCII characters in the string returned by repr() using \\x , \\u , or \\U escapes. This generates a string similar to that returned by repr() in Python 2.",
    "signature": "ascii ( object , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#ascii"
  },
  "bin": {
    "summary": "Convert an integer number to a binary string prefixed with “0b”. The result is a valid Python expression. If integer is not a Python int object, it has to define an __index__() method that returns an integer. Some examples:",
    "content": "bin ( integer , / )\n\nConvert an integer number to a binary string prefixed with “0b”. The result is a valid Python expression. If integer is not a Python int object, it has to define an __index__() method that returns an integer. Some examples:\n\n>>> bin ( 3 ) '0b11' >>> bin ( - 10 ) '-0b1010' If the prefix “0b” is desired or not, you can use either of the following ways.\n\n>>> format ( 14 , '#b' ), format ( 14 , 'b' ) ('0b1110', '1110') >>> f ' { 14 : #b } ' , f ' { 14 : b } ' ('0b1110', '1110') See also enum.bin() to represent negative values as twos-complement.\n\nSee also format() for more information.\n\n```python\n>>> bin ( 3 ) '0b11' >>> bin ( - 10 ) '-0b1010'\n```\n\n```python\n>>> format ( 14 , '#b' ), format ( 14 , 'b' ) ('0b1110', '1110') >>> f ' { 14 : #b } ' , f ' { 14 : b } ' ('0b1110', '1110')\n```",
    "signature": "bin ( integer , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#bin"
  },
  "breakpoint": {
    "summary": "This function drops you into the debugger at the call site. Specifically, it calls sys.breakpointhook() , passing args and kws straight through. By default, sys.breakpointhook() calls pdb.set_trace() expecting no arguments. In this case, it is purely a convenience function so you don’t have to explicitly import pdb or type as much code to enter the debugger. However, sys.breakpointhook() can be set to some other function and breakpoint() will automatically call that, allowing you to drop into the debugger of choice. If sys.breakpointhook() is not accessible, this function will raise RuntimeError .",
    "content": "breakpoint ( * args , ** kws )\n\nThis function drops you into the debugger at the call site. Specifically, it calls sys.breakpointhook() , passing args and kws straight through. By default, sys.breakpointhook() calls pdb.set_trace() expecting no arguments. In this case, it is purely a convenience function so you don’t have to explicitly import pdb or type as much code to enter the debugger. However, sys.breakpointhook() can be set to some other function and breakpoint() will automatically call that, allowing you to drop into the debugger of choice. If sys.breakpointhook() is not accessible, this function will raise RuntimeError .\n\nBy default, the behavior of breakpoint() can be changed with the PYTHONBREAKPOINT environment variable. See sys.breakpointhook() for usage details.\n\nNote that this is not guaranteed if sys.breakpointhook() has been replaced.\n\nRaises an auditing event builtins.breakpoint with argument breakpointhook .",
    "signature": "breakpoint ( * args , ** kws )",
    "url": "https://docs.python.org/3.13/library/functions.html#breakpoint"
  },
  "callable": {
    "summary": "Return True if the object argument appears callable, False if not. If this returns True , it is still possible that a call fails, but if it is False , calling object will never succeed. Note that classes are callable (calling a class returns a new instance); instances are callable if their class has a __call__() method.",
    "content": "callable ( object , / )\n\nReturn True if the object argument appears callable, False if not. If this returns True , it is still possible that a call fails, but if it is False , calling object will never succeed. Note that classes are callable (calling a class returns a new instance); instances are callable if their class has a __call__() method.\n\nAdded in version 3.2: This function was first removed in Python 3.0 and then brought back in Python 3.2.",
    "signature": "callable ( object , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#callable"
  },
  "chr": {
    "summary": "Return the string representing a character with the specified Unicode code point. For example, chr(97) returns the string 'a' , while chr(8364) returns the string '€' . This is the inverse of ord() .",
    "content": "chr ( codepoint , / )\n\nReturn the string representing a character with the specified Unicode code point. For example, chr(97) returns the string 'a' , while chr(8364) returns the string '€' . This is the inverse of ord() .\n\nThe valid range for the argument is from 0 through 1,114,111 (0x10FFFF in base 16). ValueError will be raised if it is outside that range.",
    "signature": "chr ( codepoint , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#chr"
  },
  "classmethod": {
    "summary": "Transform a method into a class method.",
    "content": "@ classmethod\n\nTransform a method into a class method.\n\nA class method receives the class as an implicit first argument, just like an instance method receives the instance. To declare a class method, use this idiom:\n\nclass C : @classmethod def f ( cls , arg1 , arg2 ): ... The @classmethod form is a function decorator – see Function definitions for details.\n\nA class method can be called either on the class (such as C.f() ) or on an instance (such as C().f() ). The instance is ignored except for its class. If a class method is called for a derived class, the derived class object is passed as the implied first argument.\n\n```python\nclass C : @classmethod def f ( cls , arg1 , arg2 ): ...\n```",
    "signature": "@ classmethod",
    "url": "https://docs.python.org/3.13/library/functions.html#classmethod"
  },
  "compile": {
    "summary": "Compile the source into a code or AST object. Code objects can be executed by exec() or eval() . source can either be a normal string, a byte string, or an AST object. Refer to the ast module documentation for information on how to work with AST objects.",
    "content": "compile ( source , filename , mode , flags = 0 , dont_inherit = False , optimize = -1 )\n\nCompile the source into a code or AST object. Code objects can be executed by exec() or eval() . source can either be a normal string, a byte string, or an AST object. Refer to the ast module documentation for information on how to work with AST objects.\n\nThe filename argument should give the file from which the code was read; pass some recognizable value if it wasn’t read from a file ( '<string>' is commonly used).\n\nThe mode argument specifies what kind of code must be compiled; it can be 'exec' if source consists of a sequence of statements, 'eval' if it consists of a single expression, or 'single' if it consists of a single interactive statement (in the latter case, expression statements that evaluate to something other than None will be printed).\n\nThe optional arguments flags and dont_inherit control which compiler options should be activated and which future features should be allowed. If neither is present (or both are zero) the code is compiled with the same flags that affect the code that is calling compile() . If the flags argument is given and dont_inherit is not (or is zero) then the compiler options and the future statements specified by the flags argument are used in addition to those that would be used anyway. If dont_inherit is a non-zero integer then the flags argument is it – the flags (future features and compiler options) in the surrounding code are ignored.",
    "signature": "compile ( source , filename , mode , flags = 0 , dont_inherit = False , optimize = -1 )",
    "url": "https://docs.python.org/3.13/library/functions.html#compile"
  },
  "complex": {
    "summary": "Convert a single string or number to a complex number, or create a complex number from real and imaginary parts.",
    "content": "class complex ( number = 0 , / ) ¶ class complex ( string , / ) class complex ( real = 0 , imag = 0 )\n\nConvert a single string or number to a complex number, or create a complex number from real and imaginary parts.\n\n>>> complex ( '+1.23' ) (1.23+0j) >>> complex ( '-4.5j' ) -4.5j >>> complex ( '-1.23+4.5j' ) (-1.23+4.5j) >>> complex ( ' \\t ( -1.23+4.5J ) \\n ' ) (-1.23+4.5j) >>> complex ( '-Infinity+NaNj' ) (-inf+nanj) >>> complex ( 1.23 ) (1.23+0j) >>> complex ( imag =- 4.5 ) -4.5j >>> complex ( - 1.23 , 4.5 ) (-1.23+4.5j) If the argument is a string, it must contain either a real part (in the same format as for float() ) or an imaginary part (in the same format but with a 'j' or 'J' suffix), or both real and imaginary parts (the sign of the imaginary part is mandatory in this case). The string can optionally be surrounded by whitespaces and the round parentheses '(' and ')' , which are ignored. The string must not contain whitespace between '+' , '-' , the 'j' or 'J' suffix, and the decimal number. For example, complex('1+2j') is fine, but complex('1 + 2j') raises ValueError . More precisely, the input must conform to the complexvalue production rule in the following grammar, after parentheses and leading and trailing whitespace characters are removed:\n\ncomplexvalue ::= floatvalue | floatvalue (\"j\" | \"J\") | floatvalue sign absfloatvalue (\"j\" | \"J\") If the argument is a number, the constructor serves as a numeric conversion like int and float . For a general Python object x ,…",
    "signature": "class complex ( number = 0 , / ) ¶ class complex ( string , / ) class complex ( real = 0 , imag = 0 )",
    "url": "https://docs.python.org/3.13/library/functions.html#complex"
  },
  "delattr": {
    "summary": "This is a relative of setattr() . The arguments are an object and a string. The string must be the name of one of the object’s attributes. The function deletes the named attribute, provided the object allows it. For example, delattr(x, 'foobar') is equivalent to del x.foobar . name need not be a Python identifier (see setattr() ).",
    "content": "delattr ( object , name , / )\n\nThis is a relative of setattr() . The arguments are an object and a string. The string must be the name of one of the object’s attributes. The function deletes the named attribute, provided the object allows it. For example, delattr(x, 'foobar') is equivalent to del x.foobar . name need not be a Python identifier (see setattr() ).",
    "signature": "delattr ( object , name , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#delattr"
  },
  "dir": {
    "summary": "Without arguments, return the list of names in the current local scope. With an argument, attempt to return a list of valid attributes for that object.",
    "content": "dir ( ) ¶ dir ( object , / )\n\nWithout arguments, return the list of names in the current local scope. With an argument, attempt to return a list of valid attributes for that object.\n\nIf the object has a method named __dir__() , this method will be called and must return the list of attributes. This allows objects that implement a custom __getattr__() or __getattribute__() function to customize the way dir() reports their attributes.\n\nIf the object does not provide __dir__() , the function tries its best to gather information from the object’s __dict__ attribute, if defined, and from its type object. The resulting list is not necessarily complete and may be inaccurate when the object has a custom __getattr__() .\n\nThe default dir() mechanism behaves differently with different types of objects, as it attempts to produce the most relevant, rather than complete, information:",
    "signature": "dir ( ) ¶ dir ( object , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#dir"
  },
  "divmod": {
    "summary": "Take two (non-complex) numbers as arguments and return a pair of numbers consisting of their quotient and remainder when using integer division. With mixed operand types, the rules for binary arithmetic operators apply. For integers, the result is the same as (a // b, a % b) . For floating-point numbers the result is (q, a % b) , where q is usually math.floor(a / b) but may be 1 less than that. In any case q * b + a % b is very close to a , if a % b is non-zero it has the same sign as b , and 0 <= abs(a % b) < abs(b) .",
    "content": "divmod ( a , b , / )\n\nTake two (non-complex) numbers as arguments and return a pair of numbers consisting of their quotient and remainder when using integer division. With mixed operand types, the rules for binary arithmetic operators apply. For integers, the result is the same as (a // b, a % b) . For floating-point numbers the result is (q, a % b) , where q is usually math.floor(a / b) but may be 1 less than that. In any case q * b + a % b is very close to a , if a % b is non-zero it has the same sign as b , and 0 <= abs(a % b) < abs(b) .",
    "signature": "divmod ( a , b , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#divmod"
  },
  "enumerate": {
    "summary": "Return an enumerate object. iterable must be a sequence, an iterator , or some other object which supports iteration. The __next__() method of the iterator returned by enumerate() returns a tuple containing a count (from start which defaults to 0) and the values obtained from iterating over iterable .",
    "content": "enumerate ( iterable , start = 0 )\n\nReturn an enumerate object. iterable must be a sequence, an iterator , or some other object which supports iteration. The __next__() method of the iterator returned by enumerate() returns a tuple containing a count (from start which defaults to 0) and the values obtained from iterating over iterable .\n\n>>> seasons = [ 'Spring' , 'Summer' , 'Fall' , 'Winter' ] >>> list ( enumerate ( seasons )) [(0, 'Spring'), (1, 'Summer'), (2, 'Fall'), (3, 'Winter')] >>> list ( enumerate ( seasons , start = 1 )) [(1, 'Spring'), (2, 'Summer'), (3, 'Fall'), (4, 'Winter')] Equivalent to:\n\n```python\n>>> seasons = [ 'Spring' , 'Summer' , 'Fall' , 'Winter' ] >>> list ( enumerate ( seasons )) [(0, 'Spring'), (1, 'Summer'), (2, 'Fall'), (3, 'Winter')] >>> list ( enumerate ( seasons , start = 1 )) [(1, 'Spring'), (2, 'Summer'), (3, 'Fall'), (4, 'Winter')]\n```\n\n```python\ndef enumerate ( iterable , start = 0 ): n = start for elem in iterable : yield n , elem n += 1\n```",
    "signature": "enumerate ( iterable , start = 0 )",
    "url": "https://docs.python.org/3.13/library/functions.html#enumerate"
  },
  "eval": {
    "summary": "source ( str | code object ) – A Python expression.",
    "content": "eval ( source , / , globals = None , locals = None )\n\nsource ( str | code object ) – A Python expression.\n\nglobals ( dict | None ) – The global namespace (default: None ).\n\nlocals ( mapping | None ) – The local namespace (default: None ).",
    "signature": "eval ( source , / , globals = None , locals = None )",
    "url": "https://docs.python.org/3.13/library/functions.html#eval"
  },
  "exec": {
    "summary": "This function executes arbitrary code. Calling it with untrusted user-supplied input will lead to security vulnerabilities.",
    "content": "exec ( source , / , globals = None , locals = None , * , closure = None )\n\nThis function executes arbitrary code. Calling it with untrusted user-supplied input will lead to security vulnerabilities.\n\nThis function supports dynamic execution of Python code. source must be either a string or a code object. If it is a string, the string is parsed as a suite of Python statements which is then executed (unless a syntax error occurs). [ 1 ] If it is a code object, it is simply executed. In all cases, the code that’s executed is expected to be valid as file input (see the section File input in the Reference Manual). Be aware that the nonlocal , yield , and return statements may not be used outside of function definitions even within the context of code passed to the exec() function. The return value is None .\n\nIn all cases, if the optional parts are omitted, the code is executed in the current scope. If only globals is provided, it must be a dictionary (and not a subclass of dictionary), which will be used for both the global and the local variables. If globals and locals are given, they are used for the global and local variables, respectively. If provided, locals can be any mapping object. Remember that at the module level, globals and locals are the same dictionary.",
    "signature": "exec ( source , / , globals = None , locals = None , * , closure = None )",
    "url": "https://docs.python.org/3.13/library/functions.html#exec"
  },
  "filter": {
    "summary": "Construct an iterator from those elements of iterable for which function is true. iterable may be either a sequence, a container which supports iteration, or an iterator. If function is None , the identity function is assumed, that is, all elements of iterable that are false are removed.",
    "content": "filter ( function , iterable , / )\n\nConstruct an iterator from those elements of iterable for which function is true. iterable may be either a sequence, a container which supports iteration, or an iterator. If function is None , the identity function is assumed, that is, all elements of iterable that are false are removed.\n\nNote that filter(function, iterable) is equivalent to the generator expression (item for item in iterable if function(item)) if function is not None and (item for item in iterable if item) if function is None .\n\nSee itertools.filterfalse() for the complementary function that returns elements of iterable for which function is false.",
    "signature": "filter ( function , iterable , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#filter"
  },
  "format": {
    "summary": "Convert a value to a “formatted” representation, as controlled by format_spec . The interpretation of format_spec will depend on the type of the value argument; however, there is a standard formatting syntax that is used by most built-in types: Format specification mini-language .",
    "content": "format ( value , format_spec = '' , / )\n\nConvert a value to a “formatted” representation, as controlled by format_spec . The interpretation of format_spec will depend on the type of the value argument; however, there is a standard formatting syntax that is used by most built-in types: Format specification mini-language .\n\nThe default format_spec is an empty string which usually gives the same effect as calling str(value) .\n\nA call to format(value, format_spec) is translated to type(value).__format__(value, format_spec) which bypasses the instance dictionary when searching for the value’s __format__() method. A TypeError exception is raised if the method search reaches object and the format_spec is non-empty, or if either the format_spec or the return value are not strings.\n\nChanged in version 3.4: object().__format__(format_spec) raises TypeError if format_spec is not an empty string.",
    "signature": "format ( value , format_spec = '' , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#format"
  },
  "getattr": {
    "summary": "Return the value of the named attribute of object . name must be a string. If the string is the name of one of the object’s attributes, the result is the value of that attribute. For example, getattr(x, 'foobar') is equivalent to x.foobar . If the named attribute does not exist, default is returned if provided, otherwise AttributeError is raised. name need not be a Python identifier (see setattr() ).",
    "content": "getattr ( object , name , / ) ¶ getattr ( object , name , default , / )\n\nReturn the value of the named attribute of object . name must be a string. If the string is the name of one of the object’s attributes, the result is the value of that attribute. For example, getattr(x, 'foobar') is equivalent to x.foobar . If the named attribute does not exist, default is returned if provided, otherwise AttributeError is raised. name need not be a Python identifier (see setattr() ).\n\nSince private name mangling happens at compilation time, one must manually mangle a private attribute’s (attributes with two leading underscores) name in order to retrieve it with getattr() .",
    "signature": "getattr ( object , name , / ) ¶ getattr ( object , name , default , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#getattr"
  },
  "globals": {
    "summary": "Return the dictionary implementing the current module namespace. For code within functions, this is set when the function is defined and remains the same regardless of where the function is called.",
    "content": "globals ( )\n\nReturn the dictionary implementing the current module namespace. For code within functions, this is set when the function is defined and remains the same regardless of where the function is called.",
    "signature": "globals ( )",
    "url": "https://docs.python.org/3.13/library/functions.html#globals"
  },
  "hasattr": {
    "summary": "The arguments are an object and a string. The result is True if the string is the name of one of the object’s attributes, False if not. (This is implemented by calling getattr(object, name) and seeing whether it raises an AttributeError or not.)",
    "content": "hasattr ( object , name , / )\n\nThe arguments are an object and a string. The result is True if the string is the name of one of the object’s attributes, False if not. (This is implemented by calling getattr(object, name) and seeing whether it raises an AttributeError or not.)",
    "signature": "hasattr ( object , name , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#hasattr"
  },
  "hash": {
    "summary": "Return the hash value of the object (if it has one). Hash values are integers. They are used to quickly compare dictionary keys during a dictionary lookup. Numeric values that compare equal have the same hash value (even if they are of different types, as is the case for 1 and 1.0).",
    "content": "hash ( object , / )\n\nReturn the hash value of the object (if it has one). Hash values are integers. They are used to quickly compare dictionary keys during a dictionary lookup. Numeric values that compare equal have the same hash value (even if they are of different types, as is the case for 1 and 1.0).\n\nFor objects with custom __hash__() methods, note that hash() truncates the return value based on the bit width of the host machine.",
    "signature": "hash ( object , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#hash"
  },
  "help": {
    "summary": "Invoke the built-in help system. (This function is intended for interactive use.) If no argument is given, the interactive help system starts on the interpreter console. If the argument is a string, then the string is looked up as the name of a module, function, class, method, keyword, or documentation topic, and a help page is printed on the console. If the argument is any other kind of object, a help page on the object is generated.",
    "content": "help ( ) ¶ help ( request )\n\nInvoke the built-in help system. (This function is intended for interactive use.) If no argument is given, the interactive help system starts on the interpreter console. If the argument is a string, then the string is looked up as the name of a module, function, class, method, keyword, or documentation topic, and a help page is printed on the console. If the argument is any other kind of object, a help page on the object is generated.\n\nNote that if a slash(/) appears in the parameter list of a function when invoking help() , it means that the parameters prior to the slash are positional-only. For more info, see the FAQ entry on positional-only parameters .\n\nThis function is added to the built-in namespace by the site module.\n\nChanged in version 3.4: Changes to pydoc and inspect mean that the reported signatures for callables are now more comprehensive and consistent.",
    "signature": "help ( ) ¶ help ( request )",
    "url": "https://docs.python.org/3.13/library/functions.html#help"
  },
  "hex": {
    "summary": "Convert an integer number to a lowercase hexadecimal string prefixed with “0x”. If integer is not a Python int object, it has to define an __index__() method that returns an integer. Some examples:",
    "content": "hex ( integer , / )\n\nConvert an integer number to a lowercase hexadecimal string prefixed with “0x”. If integer is not a Python int object, it has to define an __index__() method that returns an integer. Some examples:\n\n>>> hex ( 255 ) '0xff' >>> hex ( - 42 ) '-0x2a' If you want to convert an integer number to an uppercase or lower hexadecimal string with prefix or not, you can use either of the following ways:\n\n>>> ' %#x ' % 255 , ' %x ' % 255 , ' %X ' % 255 ('0xff', 'ff', 'FF') >>> format ( 255 , '#x' ), format ( 255 , 'x' ), format ( 255 , 'X' ) ('0xff', 'ff', 'FF') >>> f ' { 255 : #x } ' , f ' { 255 : x } ' , f ' { 255 : X } ' ('0xff', 'ff', 'FF') See also format() for more information.\n\nSee also int() for converting a hexadecimal string to an integer using a base of 16.\n\n```python\n>>> hex ( 255 ) '0xff' >>> hex ( - 42 ) '-0x2a'\n```\n\n```python\n>>> ' %#x ' % 255 , ' %x ' % 255 , ' %X ' % 255 ('0xff', 'ff', 'FF') >>> format ( 255 , '#x' ), format ( 255 , 'x' ), format ( 255 , 'X' ) ('0xff', 'ff', 'FF') >>> f ' { 255 : #x } ' , f ' { 255 : x } ' , f ' { 255 : X } ' ('0xff', 'ff', 'FF')\n```",
    "signature": "hex ( integer , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#hex"
  },
  "id": {
    "summary": "Return the “identity” of an object. This is an integer which is guaranteed to be unique and constant for this object during its lifetime. Two objects with non-overlapping lifetimes may have the same id() value.",
    "content": "id ( object , / )\n\nReturn the “identity” of an object. This is an integer which is guaranteed to be unique and constant for this object during its lifetime. Two objects with non-overlapping lifetimes may have the same id() value.\n\nCPython implementation detail: This is the address of the object in memory.\n\nRaises an auditing event builtins.id with argument id .",
    "signature": "id ( object , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#id"
  },
  "input": {
    "summary": "If the prompt argument is present, it is written to standard output without a trailing newline. The function then reads a line from input, converts it to a string (stripping a trailing newline), and returns that. When EOF is read, EOFError is raised. Example:",
    "content": "input ( ) ¶ input ( prompt , / )\n\nIf the prompt argument is present, it is written to standard output without a trailing newline. The function then reads a line from input, converts it to a string (stripping a trailing newline), and returns that. When EOF is read, EOFError is raised. Example:\n\n>>> s = input ( '--> ' ) --> Monty Python's Flying Circus >>> s \"Monty Python's Flying Circus\" If the readline module was loaded, then input() will use it to provide elaborate line editing and history features.\n\nRaises an auditing event builtins.input with argument prompt before reading input\n\nRaises an auditing event builtins.input/result with the result after successfully reading input.\n\n```python\n>>> s = input ( '--> ' ) --> Monty Python's Flying Circus >>> s \"Monty Python's Flying Circus\"\n```",
    "signature": "input ( ) ¶ input ( prompt , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#input"
  },
  "isinstance": {
    "summary": "Return True if the object argument is an instance of the classinfo argument, or of a (direct, indirect, or virtual ) subclass thereof. If object is not an object of the given type, the function always returns False . If classinfo is a tuple of type objects (or recursively, other such tuples) or a Union Type of multiple types, return True if object is an instance of any of the types. If classinfo is not a type or tuple of types and such tuples, a TypeError exception is raised. TypeError may not be raised for an invalid type if an earlier check succeeds.",
    "content": "isinstance ( object , classinfo , / )\n\nReturn True if the object argument is an instance of the classinfo argument, or of a (direct, indirect, or virtual ) subclass thereof. If object is not an object of the given type, the function always returns False . If classinfo is a tuple of type objects (or recursively, other such tuples) or a Union Type of multiple types, return True if object is an instance of any of the types. If classinfo is not a type or tuple of types and such tuples, a TypeError exception is raised. TypeError may not be raised for an invalid type if an earlier check succeeds.\n\nChanged in version 3.10: classinfo can be a Union Type .",
    "signature": "isinstance ( object , classinfo , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#isinstance"
  },
  "issubclass": {
    "summary": "Return True if class is a subclass (direct, indirect, or virtual ) of classinfo . A class is considered a subclass of itself. classinfo may be a tuple of class objects (or recursively, other such tuples) or a Union Type , in which case return True if class is a subclass of any entry in classinfo . In any other case, a TypeError exception is raised.",
    "content": "issubclass ( class , classinfo , / )\n\nReturn True if class is a subclass (direct, indirect, or virtual ) of classinfo . A class is considered a subclass of itself. classinfo may be a tuple of class objects (or recursively, other such tuples) or a Union Type , in which case return True if class is a subclass of any entry in classinfo . In any other case, a TypeError exception is raised.\n\nChanged in version 3.10: classinfo can be a Union Type .",
    "signature": "issubclass ( class , classinfo , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#issubclass"
  },
  "iter": {
    "summary": "Return an iterator object. The first argument is interpreted very differently depending on the presence of the second argument. Without a second argument, the single argument must be a collection object which supports the iterable protocol (the __iter__() method), or it must support the sequence protocol (the __getitem__() method with integer arguments starting at 0 ). If it does not support either of those protocols, TypeError is raised. If the second argument, sentinel , is given, then the first argument must be a callable object. The iterator created in this case will call callable with no arguments for each call to its __next__() method; if the value returned is equal to sentinel , StopIteration will be raised, otherwise the value will be returned.",
    "content": "iter ( iterable , / ) ¶ iter ( callable , sentinel , / )\n\nReturn an iterator object. The first argument is interpreted very differently depending on the presence of the second argument. Without a second argument, the single argument must be a collection object which supports the iterable protocol (the __iter__() method), or it must support the sequence protocol (the __getitem__() method with integer arguments starting at 0 ). If it does not support either of those protocols, TypeError is raised. If the second argument, sentinel , is given, then the first argument must be a callable object. The iterator created in this case will call callable with no arguments for each call to its __next__() method; if the value returned is equal to sentinel , StopIteration will be raised, otherwise the value will be returned.\n\nSee also Iterator Types .\n\nOne useful application of the second form of iter() is to build a block-reader. For example, reading fixed-width blocks from a binary database file until the end of file is reached:\n\n```python\nfrom functools import partial with open ( 'mydata.db' , 'rb' ) as f : for block in iter ( partial ( f . read , 64 ), b '' ): process_block ( block )\n```",
    "signature": "iter ( iterable , / ) ¶ iter ( callable , sentinel , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#iter"
  },
  "len": {
    "summary": "Return the length (the number of items) of an object. The argument may be a sequence (such as a string, bytes, tuple, list, or range) or a collection (such as a dictionary, set, or frozen set).",
    "content": "len ( object , / )\n\nReturn the length (the number of items) of an object. The argument may be a sequence (such as a string, bytes, tuple, list, or range) or a collection (such as a dictionary, set, or frozen set).\n\nCPython implementation detail: len raises OverflowError on lengths larger than sys.maxsize , such as range(2 ** 100) .",
    "signature": "len ( object , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#len"
  },
  "locals": {
    "summary": "Return a mapping object representing the current local symbol table, with variable names as the keys, and their currently bound references as the values.",
    "content": "locals ( )\n\nReturn a mapping object representing the current local symbol table, with variable names as the keys, and their currently bound references as the values.\n\nAt module scope, as well as when using exec() or eval() with a single namespace, this function returns the same namespace as globals() .\n\nAt class scope, it returns the namespace that will be passed to the metaclass constructor.\n\nWhen using exec() or eval() with separate local and global arguments, it returns the local namespace passed in to the function call.",
    "signature": "locals ( )",
    "url": "https://docs.python.org/3.13/library/functions.html#locals"
  },
  "map": {
    "summary": "Return an iterator that applies function to every item of iterable , yielding the results. If additional iterables arguments are passed, function must take that many arguments and is applied to the items from all iterables in parallel. With multiple iterables, the iterator stops when the shortest iterable is exhausted. For cases where the function inputs are already arranged into argument tuples, see itertools.starmap() .",
    "content": "map ( function , iterable , * iterables )\n\nReturn an iterator that applies function to every item of iterable , yielding the results. If additional iterables arguments are passed, function must take that many arguments and is applied to the items from all iterables in parallel. With multiple iterables, the iterator stops when the shortest iterable is exhausted. For cases where the function inputs are already arranged into argument tuples, see itertools.starmap() .",
    "signature": "map ( function , iterable , * iterables )",
    "url": "https://docs.python.org/3.13/library/functions.html#map"
  },
  "max": {
    "summary": "Return the largest item in an iterable or the largest of two or more arguments.",
    "content": "max ( iterable , / , * , key = None ) ¶ max ( iterable , / , * , default , key = None ) max ( arg1 , arg2 , / , * args , key = None )\n\nReturn the largest item in an iterable or the largest of two or more arguments.\n\nIf one positional argument is provided, it should be an iterable . The largest item in the iterable is returned. If two or more positional arguments are provided, the largest of the positional arguments is returned.\n\nThere are two optional keyword-only arguments. The key argument specifies a one-argument ordering function like that used for list.sort() . The default argument specifies an object to return if the provided iterable is empty. If the iterable is empty and default is not provided, a ValueError is raised.\n\nIf multiple items are maximal, the function returns the first one encountered. This is consistent with other sort-stability preserving tools such as sorted(iterable, key=keyfunc, reverse=True)[0] and heapq.nlargest(1, iterable, key=keyfunc) .",
    "signature": "max ( iterable , / , * , key = None ) ¶ max ( iterable , / , * , default , key = None ) max ( arg1 , arg2 , / , * args , key = None )",
    "url": "https://docs.python.org/3.13/library/functions.html#max"
  },
  "min": {
    "summary": "Return the smallest item in an iterable or the smallest of two or more arguments.",
    "content": "min ( iterable , / , * , key = None ) ¶ min ( iterable , / , * , default , key = None ) min ( arg1 , arg2 , / , * args , key = None )\n\nReturn the smallest item in an iterable or the smallest of two or more arguments.\n\nIf one positional argument is provided, it should be an iterable . The smallest item in the iterable is returned. If two or more positional arguments are provided, the smallest of the positional arguments is returned.\n\nThere are two optional keyword-only arguments. The key argument specifies a one-argument ordering function like that used for list.sort() . The default argument specifies an object to return if the provided iterable is empty. If the iterable is empty and default is not provided, a ValueError is raised.\n\nIf multiple items are minimal, the function returns the first one encountered. This is consistent with other sort-stability preserving tools such as sorted(iterable, key=keyfunc)[0] and heapq.nsmallest(1, iterable, key=keyfunc) .",
    "signature": "min ( iterable , / , * , key = None ) ¶ min ( iterable , / , * , default , key = None ) min ( arg1 , arg2 , / , * args , key = None )",
    "url": "https://docs.python.org/3.13/library/functions.html#min"
  },
  "next": {
    "summary": "Retrieve the next item from the iterator by calling its __next__() method. If default is given, it is returned if the iterator is exhausted, otherwise StopIteration is raised.",
    "content": "next ( iterator , / ) ¶ next ( iterator , default , / )\n\nRetrieve the next item from the iterator by calling its __next__() method. If default is given, it is returned if the iterator is exhausted, otherwise StopIteration is raised.",
    "signature": "next ( iterator , / ) ¶ next ( iterator , default , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#next"
  },
  "oct": {
    "summary": "Convert an integer number to an octal string prefixed with “0o”. The result is a valid Python expression. If integer is not a Python int object, it has to define an __index__() method that returns an integer. For example:",
    "content": "oct ( integer , / )\n\nConvert an integer number to an octal string prefixed with “0o”. The result is a valid Python expression. If integer is not a Python int object, it has to define an __index__() method that returns an integer. For example:\n\n>>> oct ( 8 ) '0o10' >>> oct ( - 56 ) '-0o70' If you want to convert an integer number to an octal string either with the prefix “0o” or not, you can use either of the following ways.\n\n>>> ' %#o ' % 10 , ' %o ' % 10 ('0o12', '12') >>> format ( 10 , '#o' ), format ( 10 , 'o' ) ('0o12', '12') >>> f ' { 10 : #o } ' , f ' { 10 : o } ' ('0o12', '12') See also format() for more information.\n\n```python\n>>> oct ( 8 ) '0o10' >>> oct ( - 56 ) '-0o70'\n```\n\n```python\n>>> ' %#o ' % 10 , ' %o ' % 10 ('0o12', '12') >>> format ( 10 , '#o' ), format ( 10 , 'o' ) ('0o12', '12') >>> f ' { 10 : #o } ' , f ' { 10 : o } ' ('0o12', '12')\n```",
    "signature": "oct ( integer , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#oct"
  },
  "open": {
    "summary": "Open file and return a corresponding file object . If the file cannot be opened, an OSError is raised. See Reading and Writing Files for more examples of how to use this function.",
    "content": "open ( file , mode = 'r' , buffering = -1 , encoding = None , errors = None , newline = None , closefd = True , opener = None )\n\nOpen file and return a corresponding file object . If the file cannot be opened, an OSError is raised. See Reading and Writing Files for more examples of how to use this function.\n\nfile is a path-like object giving the pathname (absolute or relative to the current working directory) of the file to be opened or an integer file descriptor of the file to be wrapped. (If a file descriptor is given, it is closed when the returned I/O object is closed unless closefd is set to False .)\n\nmode is an optional string that specifies the mode in which the file is opened. It defaults to 'r' which means open for reading in text mode. Other common values are 'w' for writing (truncating the file if it already exists), 'x' for exclusive creation, and 'a' for appending (which on some Unix systems, means that all writes append to the end of the file regardless of the current seek position). In text mode, if encoding is not specified the encoding used is platform-dependent: locale.getencoding() is called to get the current locale encoding. (For reading and writing raw bytes use binary mode and leave encoding unspecified.) The available modes are:\n\n```python\n>>> import os >>> dir_fd = os . open ( 'somedir' , os . O_RDONLY ) >>> def opener ( path , flags ): ... return os . open ( path , flags , dir_fd = dir_fd ) ... >>> with open ( 'spamspam.txt' , 'w' , opener = opener )…",
    "signature": "open ( file , mode = 'r' , buffering = -1 , encoding = None , errors = None , newline = None , closefd = True , opener = None )",
    "url": "https://docs.python.org/3.13/library/functions.html#open"
  },
  "ord": {
    "summary": "Return the ordinal value of a character.",
    "content": "ord ( character , / )\n\nReturn the ordinal value of a character.\n\nIf the argument is a one-character string, return the Unicode code point of that character. For example, ord('a') returns the integer 97 and ord('€') (Euro sign) returns 8364 . This is the inverse of chr() .\n\nIf the argument is a bytes or bytearray object of length 1, return its single byte value. For example, ord(b'a') returns the integer 97 .",
    "signature": "ord ( character , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#ord"
  },
  "pow": {
    "summary": "Return base to the power exp ; if mod is present, return base to the power exp , modulo mod (computed more efficiently than pow(base, exp) % mod ). The two-argument form pow(base, exp) is equivalent to using the power operator: base**exp .",
    "content": "pow ( base , exp , mod = None )\n\nReturn base to the power exp ; if mod is present, return base to the power exp , modulo mod (computed more efficiently than pow(base, exp) % mod ). The two-argument form pow(base, exp) is equivalent to using the power operator: base**exp .\n\nWhen arguments are builtin numeric types with mixed operand types, the coercion rules for binary arithmetic operators apply. For int operands, the result has the same type as the operands (after coercion) unless the second argument is negative; in that case, all arguments are converted to float and a float result is delivered. For example, pow(10, 2) returns 100 , but pow(10, -2) returns 0.01 . For a negative base of type int or float and a non-integral exponent, a complex result is delivered. For example, pow(-9, 0.5) returns a value close to 3j . Whereas, for a negative base of type int or float with an integral exponent, a float result is delivered. For example, pow(-9, 2.0) returns 81.0 .\n\nFor int operands base and exp , if mod is present, mod must also be of integer type and mod must be nonzero. If mod is present and exp is negative, base must be relatively prime to mod . In that case, pow(inv_base, -exp, mod) is returned, where inv_base is an inverse to base modulo mod .\n\nHere’s an example of computing an inverse for 38 modulo 97 :\n\n```python\n>>> pow ( 38 , - 1 , mod = 97 ) 23 >>> 23 * 38 % 97 == 1 True\n```",
    "signature": "pow ( base , exp , mod = None )",
    "url": "https://docs.python.org/3.13/library/functions.html#pow"
  },
  "print": {
    "summary": "Print objects to the text stream file , separated by sep and followed by end . sep , end , file , and flush , if present, must be given as keyword arguments.",
    "content": "print ( * objects , sep = ' ' , end = '\\n' , file = None , flush = False )\n\nPrint objects to the text stream file , separated by sep and followed by end . sep , end , file , and flush , if present, must be given as keyword arguments.\n\nAll non-keyword arguments are converted to strings like str() does and written to the stream, separated by sep and followed by end . Both sep and end must be strings; they can also be None , which means to use the default values. If no objects are given, print() will just write end .\n\nThe file argument must be an object with a write(string) method; if it is not present or None , sys.stdout will be used. Since printed arguments are converted to text strings, print() cannot be used with binary mode file objects. For these, use file.write(...) instead.\n\nOutput buffering is usually determined by file . However, if flush is true, the stream is forcibly flushed.",
    "signature": "print ( * objects , sep = ' ' , end = '\\n' , file = None , flush = False )",
    "url": "https://docs.python.org/3.13/library/functions.html#print"
  },
  "property": {
    "summary": "Return a property attribute.",
    "content": "class property ( fget = None , fset = None , fdel = None , doc = None )\n\nReturn a property attribute.\n\nfget is a function for getting an attribute value. fset is a function for setting an attribute value. fdel is a function for deleting an attribute value. And doc creates a docstring for the attribute.\n\nA typical use is to define a managed attribute x :\n\nclass C : def __init__ ( self ): self . _x = None def getx ( self ): return self . _x def setx ( self , value ): self . _x = value def delx ( self ): del self . _x x = property ( getx , setx , delx , \"I'm the 'x' property.\" ) If c is an instance of C , c.x will invoke the getter, c.x = value will invoke the setter, and del c.x the deleter.\n\n```python\nclass C : def __init__ ( self ): self . _x = None def getx ( self ): return self . _x def setx ( self , value ): self . _x = value def delx ( self ): del self . _x x = property ( getx , setx , delx , \"I'm the 'x' property.\" )\n```\n\n```python\nclass Parrot : def __init__ ( self ): self . _voltage = 100000 @property def voltage ( self ): \"\"\"Get the current voltage.\"\"\" return self . _voltage\n```",
    "signature": "class property ( fget = None , fset = None , fdel = None , doc = None )",
    "url": "https://docs.python.org/3.13/library/functions.html#property"
  },
  "repr": {
    "summary": "Return a string containing a printable representation of an object. For many types, this function makes an attempt to return a string that would yield an object with the same value when passed to eval() ; otherwise, the representation is a string enclosed in angle brackets that contains the name of the type of the object together with additional information often including the name and address of the object. A class can control what this function returns for its instances by defining a __repr__() method. If sys.displayhook() is not accessible, this function will raise RuntimeError .",
    "content": "repr ( object , / )\n\nReturn a string containing a printable representation of an object. For many types, this function makes an attempt to return a string that would yield an object with the same value when passed to eval() ; otherwise, the representation is a string enclosed in angle brackets that contains the name of the type of the object together with additional information often including the name and address of the object. A class can control what this function returns for its instances by defining a __repr__() method. If sys.displayhook() is not accessible, this function will raise RuntimeError .\n\nThis class has a custom representation that can be evaluated:\n\n```python\nclass Person : def __init__ ( self , name , age ): self . name = name self . age = age def __repr__ ( self ): return f \"Person(' { self . name } ', { self . age } )\"\n```",
    "signature": "repr ( object , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#repr"
  },
  "reversed": {
    "summary": "Return a reverse iterator . The argument must be an object which has a __reversed__() method or supports the sequence protocol (the __len__() method and the __getitem__() method with integer arguments starting at 0 ).",
    "content": "reversed ( object , / )\n\nReturn a reverse iterator . The argument must be an object which has a __reversed__() method or supports the sequence protocol (the __len__() method and the __getitem__() method with integer arguments starting at 0 ).",
    "signature": "reversed ( object , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#reversed"
  },
  "round": {
    "summary": "Return number rounded to ndigits precision after the decimal point. If ndigits is omitted or is None , it returns the nearest integer to its input.",
    "content": "round ( number , ndigits = None )\n\nReturn number rounded to ndigits precision after the decimal point. If ndigits is omitted or is None , it returns the nearest integer to its input.\n\nFor the built-in types supporting round() , values are rounded to the closest multiple of 10 to the power minus ndigits ; if two multiples are equally close, rounding is done toward the even choice (so, for example, both round(0.5) and round(-0.5) are 0 , and round(1.5) is 2 ). Any integer value is valid for ndigits (positive, zero, or negative). The return value is an integer if ndigits is omitted or None . Otherwise, the return value has the same type as number .\n\nFor a general Python object number , round delegates to number.__round__ .",
    "signature": "round ( number , ndigits = None )",
    "url": "https://docs.python.org/3.13/library/functions.html#round"
  },
  "setattr": {
    "summary": "This is the counterpart of getattr() . The arguments are an object, a string, and an arbitrary value. The string may name an existing attribute or a new attribute. The function assigns the value to the attribute, provided the object allows it. For example, setattr(x, 'foobar', 123) is equivalent to x.foobar = 123 .",
    "content": "setattr ( object , name , value , / )\n\nThis is the counterpart of getattr() . The arguments are an object, a string, and an arbitrary value. The string may name an existing attribute or a new attribute. The function assigns the value to the attribute, provided the object allows it. For example, setattr(x, 'foobar', 123) is equivalent to x.foobar = 123 .\n\nname need not be a Python identifier as defined in Identifiers and keywords unless the object chooses to enforce that, for example in a custom __getattribute__() or via __slots__ . An attribute whose name is not an identifier will not be accessible using the dot notation, but is accessible through getattr() etc..\n\nSince private name mangling happens at compilation time, one must manually mangle a private attribute’s (attributes with two leading underscores) name in order to set it with setattr() .",
    "signature": "setattr ( object , name , value , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#setattr"
  },
  "slice": {
    "summary": "Return a slice object representing the set of indices specified by range(start, stop, step) . The start and step arguments default to None .",
    "content": "class slice ( stop , / ) ¶ class slice ( start , stop , step = None , / )\n\nReturn a slice object representing the set of indices specified by range(start, stop, step) . The start and step arguments default to None .\n\nSlice objects have read-only data attributes start , stop , and step which merely return the argument values (or their default). They have no other explicit functionality; however, they are used by NumPy and other third-party packages.",
    "signature": "class slice ( stop , / ) ¶ class slice ( start , stop , step = None , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#slice"
  },
  "sorted": {
    "summary": "Return a new sorted list from the items in iterable .",
    "content": "sorted ( iterable , / , * , key = None , reverse = False )\n\nReturn a new sorted list from the items in iterable .\n\nHas two optional arguments which must be specified as keyword arguments.\n\nkey specifies a function of one argument that is used to extract a comparison key from each element in iterable (for example, key=str.lower ). The default value is None (compare the elements directly).\n\nreverse is a boolean value. If set to True , then the list elements are sorted as if each comparison were reversed.",
    "signature": "sorted ( iterable , / , * , key = None , reverse = False )",
    "url": "https://docs.python.org/3.13/library/functions.html#sorted"
  },
  "staticmethod": {
    "summary": "Transform a method into a static method.",
    "content": "@ staticmethod\n\nTransform a method into a static method.\n\nA static method does not receive an implicit first argument. To declare a static method, use this idiom:\n\nclass C : @staticmethod def f ( arg1 , arg2 , argN ): ... The @staticmethod form is a function decorator – see Function definitions for details.\n\nA static method can be called either on the class (such as C.f() ) or on an instance (such as C().f() ). Moreover, the static method descriptor is also callable, so it can be used in the class definition (such as f() ).\n\n```python\nclass C : @staticmethod def f ( arg1 , arg2 , argN ): ...\n```\n\n```python\ndef regular_function (): ... class C : method = staticmethod ( regular_function )\n```",
    "signature": "@ staticmethod",
    "url": "https://docs.python.org/3.13/library/functions.html#staticmethod"
  },
  "sum": {
    "summary": "Sums start and the items of an iterable from left to right and returns the total. The iterable ’s items are normally numbers, and the start value is not allowed to be a string.",
    "content": "sum ( iterable , / , start = 0 )\n\nSums start and the items of an iterable from left to right and returns the total. The iterable ’s items are normally numbers, and the start value is not allowed to be a string.\n\nFor some use cases, there are good alternatives to sum() . The preferred, fast way to concatenate a sequence of strings is by calling ''.join(sequence) . To add floating-point values with extended precision, see math.fsum() . To concatenate a series of iterables, consider using itertools.chain() .\n\nChanged in version 3.8: The start parameter can be specified as a keyword argument.\n\nChanged in version 3.12: Summation of floats switched to an algorithm that gives higher accuracy and better commutativity on most builds.",
    "signature": "sum ( iterable , / , start = 0 )",
    "url": "https://docs.python.org/3.13/library/functions.html#sum"
  },
  "super": {
    "summary": "Return a proxy object that delegates method calls to a parent or sibling class of type . This is useful for accessing inherited methods that have been overridden in a class.",
    "content": "class super ¶ class super ( type , object_or_type = None , / )\n\nReturn a proxy object that delegates method calls to a parent or sibling class of type . This is useful for accessing inherited methods that have been overridden in a class.\n\nThe object_or_type determines the method resolution order to be searched. The search starts from the class right after the type .\n\nFor example, if __mro__ of object_or_type is D -> B -> C -> A -> object and the value of type is B , then super() searches C -> A -> object .\n\nThe __mro__ attribute of the class corresponding to object_or_type lists the method resolution search order used by both getattr() and super() . The attribute is dynamic and can change whenever the inheritance hierarchy is updated.\n\n```python\nclass C ( B ): def method ( self , arg ): super () . method ( arg ) # This does the same thing as: # super(C, self).method(arg)\n```",
    "signature": "class super ¶ class super ( type , object_or_type = None , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#super"
  },
  "type": {
    "summary": "With one argument, return the type of an object . The return value is a type object and generally the same object as returned by object.__class__ .",
    "content": "class type ( object , / ) ¶ class type ( name , bases , dict , / , ** kwargs )\n\nWith one argument, return the type of an object . The return value is a type object and generally the same object as returned by object.__class__ .\n\nThe isinstance() built-in function is recommended for testing the type of an object, because it takes subclasses into account.\n\nWith three arguments, return a new type object. This is essentially a dynamic form of the class statement. The name string is the class name and becomes the __name__ attribute. The bases tuple contains the base classes and becomes the __bases__ attribute; if empty, object , the ultimate base of all classes, is added. The dict dictionary contains attribute and method definitions for the class body; it may be copied or wrapped before becoming the __dict__ attribute. The following two statements create identical type objects:\n\n>>> class X : ... a = 1 ... >>> X = type ( 'X' , (), dict ( a = 1 )) See also:\n\n```python\n>>> class X : ... a = 1 ... >>> X = type ( 'X' , (), dict ( a = 1 ))\n```",
    "signature": "class type ( object , / ) ¶ class type ( name , bases , dict , / , ** kwargs )",
    "url": "https://docs.python.org/3.13/library/functions.html#type"
  },
  "vars": {
    "summary": "Return the __dict__ attribute for a module, class, instance, or any other object with a __dict__ attribute.",
    "content": "vars ( ) ¶ vars ( object , / )\n\nReturn the __dict__ attribute for a module, class, instance, or any other object with a __dict__ attribute.\n\nObjects such as modules and instances have an updateable __dict__ attribute; however, other objects may have write restrictions on their __dict__ attributes (for example, classes use a types.MappingProxyType to prevent direct dictionary updates).\n\nWithout an argument, vars() acts like locals() .\n\nA TypeError exception is raised if an object is specified but it doesn’t have a __dict__ attribute (for example, if its class defines the __slots__ attribute).",
    "signature": "vars ( ) ¶ vars ( object , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#vars"
  },
  "zip": {
    "summary": "Iterate over several iterables in parallel, producing tuples with an item from each one.",
    "content": "zip ( * iterables , strict = False )\n\nIterate over several iterables in parallel, producing tuples with an item from each one.\n\n>>> for item in zip ([ 1 , 2 , 3 ], [ 'sugar' , 'spice' , 'everything nice' ]): ... print ( item ) ... (1, 'sugar') (2, 'spice') (3, 'everything nice') More formally: zip() returns an iterator of tuples, where the i -th tuple contains the i -th element from each of the argument iterables.\n\nAnother way to think of zip() is that it turns rows into columns, and columns into rows. This is similar to transposing a matrix .\n\n```python\n>>> for item in zip ([ 1 , 2 , 3 ], [ 'sugar' , 'spice' , 'everything nice' ]): ... print ( item ) ... (1, 'sugar') (2, 'spice') (3, 'everything nice')\n```\n\n```python\n>>> list ( zip ( range ( 3 ), [ 'fee' , 'fi' , 'fo' , 'fum' ])) [(0, 'fee'), (1, 'fi'), (2, 'fo')]\n```",
    "signature": "zip ( * iterables , strict = False )",
    "url": "https://docs.python.org/3.13/library/functions.html#zip"
  },
  "__import__": {
    "summary": "This is an advanced function that is not needed in everyday Python programming, unlike importlib.import_module() .",
    "content": "__import__ ( name , globals = None , locals = None , fromlist = () , level = 0 )\n\nThis is an advanced function that is not needed in everyday Python programming, unlike importlib.import_module() .\n\nThis function is invoked by the import statement. It can be replaced (by importing the builtins module and assigning to builtins.__import__ ) in order to change semantics of the import statement, but doing so is strongly discouraged as it is usually simpler to use import hooks (see PEP 302 ) to attain the same goals and does not cause issues with code which assumes the default import implementation is in use. Direct use of __import__() is also discouraged in favor of importlib.import_module() .\n\nThe function imports the module name , potentially using the given globals and locals to determine how to interpret the name in a package context. The fromlist gives the names of objects or submodules that should be imported from the module given by name . The standard implementation does not use its locals argument at all and uses its globals only to determine the package context of the import statement.\n\n```python\nspam = __import__ ( 'spam' , globals (), locals (), [], 0 )\n```\n\n```python\nspam = __import__ ( 'spam.ham' , globals (), locals (), [], 0 )\n```",
    "signature": "__import__ ( name , globals = None , locals = None , fromlist = () , level = 0 )",
    "url": "https://docs.python.org/3.13/library/functions.html#import__"
  },
  "int": {
    "summary": "Return an integer object constructed from a number or a string, or return 0 if no arguments are given.",
    "content": "class int ( number = 0 , / ) ¶ class int ( string , / , base = 10 )\n\nReturn an integer object constructed from a number or a string, or return 0 if no arguments are given.\n\n>>> int ( 123.45 ) 123 >>> int ( '123' ) 123 >>> int ( ' -12_345 \\n ' ) -12345 >>> int ( 'FACE' , 16 ) 64206 >>> int ( '0xface' , 0 ) 64206 >>> int ( '01110011' , base = 2 ) 115 If the argument defines __int__() , int(x) returns x.__int__() . If the argument defines __index__() , it returns x.__index__() . If the argument defines __trunc__() , it returns x.__trunc__() . For floating-point numbers, this truncates towards zero.\n\nIf the argument is not a number or if base is given, then it must be a string, bytes , or bytearray instance representing an integer in radix base . Optionally, the string can be preceded by + or - (with no space in between), have leading zeros, be surrounded by whitespace, and have single underscores interspersed between digits.\n\n```python\n>>> int ( 123.45 ) 123 >>> int ( '123' ) 123 >>> int ( ' -12_345 \\n ' ) -12345 >>> int ( 'FACE' , 16 ) 64206 >>> int ( '0xface' , 0 ) 64206 >>> int ( '01110011' , base = 2 ) 115\n```",
    "signature": "class int ( number = 0 , / ) ¶ class int ( string , / , base = 10 )",
    "url": "https://docs.python.org/3.13/library/functions.html#int"
  },
  "float": {
    "summary": "Return a floating-point number constructed from a number or a string.",
    "content": "class float ( number = 0.0 , / ) ¶ class float ( string , / )\n\nReturn a floating-point number constructed from a number or a string.\n\n>>> float ( '+1.23' ) 1.23 >>> float ( ' -12345 \\n ' ) -12345.0 >>> float ( '1e-003' ) 0.001 >>> float ( '+1E6' ) 1000000.0 >>> float ( '-Infinity' ) -inf If the argument is a string, it should contain a decimal number, optionally preceded by a sign, and optionally embedded in whitespace. The optional sign may be '+' or '-' ; a '+' sign has no effect on the value produced. The argument may also be a string representing a NaN (not-a-number), or positive or negative infinity. More precisely, the input must conform to the floatvalue production rule in the following grammar, after leading and trailing whitespace characters are removed:\n\nsign ::= \"+\" | \"-\" infinity ::= \"Infinity\" | \"inf\" nan ::= \"nan\" digit ::= <a Unicode decimal digit, i.e. characters in Unicode general category Nd> digitpart ::= digit ([\"_\"] digit )* number ::= [ digitpart ] \".\" digitpart | digitpart [\".\"] exponent ::= (\"e\" | \"E\") [ sign ] digitpart floatnumber ::= number [ exponent ] absfloatvalue ::= floatnumber | infinity | nan floatvalue ::= [ sign ] absfloatvalue Case is not significant, so, for example, “inf”, “Inf”, “INFINITY”, and “iNfINity” are all acceptable spellings for positive infinity.\n\n```python\n>>> float ( '+1.23' ) 1.23 >>> float ( ' -12345 \\n ' ) -12345.0 >>> float ( '1e-003' ) 0.001 >>> float ( '+1E6' ) 1000000.0 >>> float ( '-Infinity' ) -inf\n```\n\n```python\nsi…",
    "signature": "class float ( number = 0.0 , / ) ¶ class float ( string , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#float"
  },
  "bool": {
    "summary": "Return a Boolean value, i.e. one of True or False . The argument is converted using the standard truth testing procedure . If the argument is false or omitted, this returns False ; otherwise, it returns True . The bool class is a subclass of int (see Numeric Types — int, float, complex ). It cannot be subclassed further. Its only instances are False and True (see Boolean Type - bool ).",
    "content": "class bool ( object = False , / )\n\nReturn a Boolean value, i.e. one of True or False . The argument is converted using the standard truth testing procedure . If the argument is false or omitted, this returns False ; otherwise, it returns True . The bool class is a subclass of int (see Numeric Types — int, float, complex ). It cannot be subclassed further. Its only instances are False and True (see Boolean Type - bool ).\n\nChanged in version 3.7: The parameter is now positional-only.",
    "signature": "class bool ( object = False , / )",
    "url": "https://docs.python.org/3.13/library/functions.html#bool"
  },
  "str": {
    "summary": "Return a str version of object . See str() for details.",
    "content": "Return a str version of object . See str() for details.\n\nstr is the built-in string class . For general information about strings, see Text Sequence Type — str .",
    "url": "https://docs.python.org/3.13/library/functions.html#func-str"
  },
  "bytes": {
    "summary": "Return a new “bytes” object which is an immutable sequence of integers in the range 0 <= x < 256 . bytes is an immutable version of bytearray – it has the same non-mutating methods and the same indexing and slicing behavior.",
    "content": "Return a new “bytes” object which is an immutable sequence of integers in the range 0 <= x < 256 . bytes is an immutable version of bytearray – it has the same non-mutating methods and the same indexing and slicing behavior.\n\nAccordingly, constructor arguments are interpreted as for bytearray() .\n\nBytes objects can also be created with literals, see String and Bytes literals .\n\nSee also Binary Sequence Types — bytes, bytearray, memoryview , Bytes Objects , and Bytes and Bytearray Operations .",
    "url": "https://docs.python.org/3.13/library/functions.html#func-bytes"
  },
  "bytearray": {
    "summary": "Return a new array of bytes. The bytearray class is a mutable sequence of integers in the range 0 <= x < 256. It has most of the usual methods of mutable sequences, described in Mutable Sequence Types , as well as most methods that the bytes type has, see Bytes and Bytearray Operations .",
    "content": "Return a new array of bytes. The bytearray class is a mutable sequence of integers in the range 0 <= x < 256. It has most of the usual methods of mutable sequences, described in Mutable Sequence Types , as well as most methods that the bytes type has, see Bytes and Bytearray Operations .\n\nThe optional source parameter can be used to initialize the array in a few different ways:\n\nIf it is a string , you must also give the encoding (and optionally, errors ) parameters; bytearray() then converts the string to bytes using str.encode() .\n\nIf it is an integer , the array will have that size and will be initialized with null bytes.",
    "url": "https://docs.python.org/3.13/library/functions.html#func-bytearray"
  },
  "memoryview": {
    "summary": "Return a “memory view” object created from the given argument. See Memory Views for more information.",
    "content": "Return a “memory view” object created from the given argument. See Memory Views for more information.",
    "url": "https://docs.python.org/3.13/library/functions.html#func-memoryview"
  },
  "list": {
    "summary": "Rather than being a function, list is actually a mutable sequence type, as documented in Lists and Sequence Types — list, tuple, range .",
    "content": "Rather than being a function, list is actually a mutable sequence type, as documented in Lists and Sequence Types — list, tuple, range .",
    "url": "https://docs.python.org/3.13/library/functions.html#func-list"
  },
  "tuple": {
    "summary": "Rather than being a function, tuple is actually an immutable sequence type, as documented in Tuples and Sequence Types — list, tuple, range .",
    "content": "Rather than being a function, tuple is actually an immutable sequence type, as documented in Tuples and Sequence Types — list, tuple, range .",
    "url": "https://docs.python.org/3.13/library/functions.html#func-tuple"
  },
  "dict": {
    "summary": "Create a new dictionary. The dict object is the dictionary class. See dict and Mapping Types — dict for documentation about this class.",
    "content": "Create a new dictionary. The dict object is the dictionary class. See dict and Mapping Types — dict for documentation about this class.\n\nFor other containers see the built-in list , set , and tuple classes, as well as the collections module.",
    "url": "https://docs.python.org/3.13/library/functions.html#func-dict"
  },
  "set": {
    "summary": "Return a new set object, optionally with elements taken from iterable . set is a built-in class. See set and Set Types — set, frozenset for documentation about this class.",
    "content": "Return a new set object, optionally with elements taken from iterable . set is a built-in class. See set and Set Types — set, frozenset for documentation about this class.\n\nFor other containers see the built-in frozenset , list , tuple , and dict classes, as well as the collections module.",
    "url": "https://docs.python.org/3.13/library/functions.html#func-set"
  },
  "frozenset": {
    "summary": "Return a new frozenset object, optionally with elements taken from iterable . frozenset is a built-in class. See frozenset and Set Types — set, frozenset for documentation about this class.",
    "content": "Return a new frozenset object, optionally with elements taken from iterable . frozenset is a built-in class. See frozenset and Set Types — set, frozenset for documentation about this class.\n\nFor other containers see the built-in set , list , tuple , and dict classes, as well as the collections module.",
    "url": "https://docs.python.org/3.13/library/functions.html#func-frozenset"
  },
  "range": {
    "summary": "Rather than being a function, range is actually an immutable sequence type, as documented in Ranges and Sequence Types — list, tuple, range .",
    "content": "Rather than being a function, range is actually an immutable sequence type, as documented in Ranges and Sequence Types — list, tuple, range .",
    "url": "https://docs.python.org/3.13/library/functions.html#func-range"
  },
  "object": {
    "summary": "This is the ultimate base class of all other classes. It has methods that are common to all instances of Python classes. When the constructor is called, it returns a new featureless object. The constructor does not accept any arguments.",
    "content": "class object\n\nThis is the ultimate base class of all other classes. It has methods that are common to all instances of Python classes. When the constructor is called, it returns a new featureless object. The constructor does not accept any arguments.\n\nobject instances do not have __dict__ attributes, so you can’t assign arbitrary attributes to an instance of object .",
    "signature": "class object",
    "url": "https://docs.python.org/3.13/library/functions.html#object"
  },
  "Exception": {
    "summary": "All built-in, non-system-exiting exceptions are derived from this class. All user-defined exceptions should also be derived from this class.",
    "content": "exception Exception\n\nAll built-in, non-system-exiting exceptions are derived from this class. All user-defined exceptions should also be derived from this class.",
    "signature": "exception Exception",
    "url": "https://docs.python.org/3.13/library/exceptions.html#Exception"
  },
  "BaseException": {
    "summary": "The base class for all built-in exceptions. It is not meant to be directly inherited by user-defined classes (for that, use Exception ). If str() is called on an instance of this class, the representation of the argument(s) to the instance are returned, or the empty string when there were no arguments.",
    "content": "exception BaseException\n\nThe base class for all built-in exceptions. It is not meant to be directly inherited by user-defined classes (for that, use Exception ). If str() is called on an instance of this class, the representation of the argument(s) to the instance are returned, or the empty string when there were no arguments.\n\nThe tuple of arguments given to the exception constructor. Some built-in exceptions (like OSError ) expect a certain number of arguments and assign a special meaning to the elements of this tuple, while others are usually called only with a single string giving an error message.",
    "signature": "exception BaseException",
    "url": "https://docs.python.org/3.13/library/exceptions.html#BaseException"
  },
  "TypeError": {
    "summary": "Raised when an operation or function is applied to an object of inappropriate type. The associated value is a string giving details about the type mismatch.",
    "content": "exception TypeError\n\nRaised when an operation or function is applied to an object of inappropriate type. The associated value is a string giving details about the type mismatch.\n\nThis exception may be raised by user code to indicate that an attempted operation on an object is not supported, and is not meant to be. If an object is meant to support a given operation but has not yet provided an implementation, NotImplementedError is the proper exception to raise.\n\nPassing arguments of the wrong type (e.g. passing a list when an int is expected) should result in a TypeError , but passing arguments with the wrong value (e.g. a number outside expected boundaries) should result in a ValueError .",
    "signature": "exception TypeError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#TypeError"
  },
  "ValueError": {
    "summary": "Raised when an operation or function receives an argument that has the right type but an inappropriate value, and the situation is not described by a more precise exception such as IndexError .",
    "content": "exception ValueError\n\nRaised when an operation or function receives an argument that has the right type but an inappropriate value, and the situation is not described by a more precise exception such as IndexError .",
    "signature": "exception ValueError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#ValueError"
  },
  "KeyError": {
    "summary": "Raised when a mapping (dictionary) key is not found in the set of existing keys.",
    "content": "exception KeyError\n\nRaised when a mapping (dictionary) key is not found in the set of existing keys.",
    "signature": "exception KeyError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#KeyError"
  },
  "IndexError": {
    "summary": "Raised when a sequence subscript is out of range. (Slice indices are silently truncated to fall in the allowed range; if an index is not an integer, TypeError is raised.)",
    "content": "exception IndexError\n\nRaised when a sequence subscript is out of range. (Slice indices are silently truncated to fall in the allowed range; if an index is not an integer, TypeError is raised.)",
    "signature": "exception IndexError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#IndexError"
  },
  "AttributeError": {
    "summary": "Raised when an attribute reference (see Attribute references ) or assignment fails. (When an object does not support attribute references or attribute assignments at all, TypeError is raised.)",
    "content": "exception AttributeError\n\nRaised when an attribute reference (see Attribute references ) or assignment fails. (When an object does not support attribute references or attribute assignments at all, TypeError is raised.)\n\nThe optional name and obj keyword-only arguments set the corresponding attributes:\n\nThe name of the attribute that was attempted to be accessed.",
    "signature": "exception AttributeError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#AttributeError"
  },
  "ImportError": {
    "summary": "Raised when the import statement has troubles trying to load a module. Also raised when the “from list” in from ... import has a name that cannot be found.",
    "content": "exception ImportError\n\nRaised when the import statement has troubles trying to load a module. Also raised when the “from list” in from ... import has a name that cannot be found.\n\nThe optional name and path keyword-only arguments set the corresponding attributes:\n\nThe name of the module that was attempted to be imported.",
    "signature": "exception ImportError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#ImportError"
  },
  "ModuleNotFoundError": {
    "summary": "A subclass of ImportError which is raised by import when a module could not be located. It is also raised when None is found in sys.modules .",
    "content": "exception ModuleNotFoundError\n\nA subclass of ImportError which is raised by import when a module could not be located. It is also raised when None is found in sys.modules .\n\nAdded in version 3.6.",
    "signature": "exception ModuleNotFoundError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#ModuleNotFoundError"
  },
  "FileNotFoundError": {
    "summary": "Raised when a file or directory is requested but doesn’t exist. Corresponds to errno ENOENT .",
    "content": "exception FileNotFoundError\n\nRaised when a file or directory is requested but doesn’t exist. Corresponds to errno ENOENT .",
    "signature": "exception FileNotFoundError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#FileNotFoundError"
  },
  "PermissionError": {
    "summary": "Raised when trying to run an operation without the adequate access rights - for example filesystem permissions. Corresponds to errno EACCES , EPERM , and ENOTCAPABLE .",
    "content": "exception PermissionError\n\nRaised when trying to run an operation without the adequate access rights - for example filesystem permissions. Corresponds to errno EACCES , EPERM , and ENOTCAPABLE .\n\nChanged in version 3.11.1: WASI’s ENOTCAPABLE is now mapped to PermissionError .",
    "signature": "exception PermissionError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#PermissionError"
  },
  "OSError": {
    "summary": "This exception is raised when a system function returns a system-related error, including I/O failures such as “file not found” or “disk full” (not for illegal argument types or other incidental errors).",
    "content": "exception OSError ( [ arg ] ) ¶ exception OSError ( errno , strerror [ , filename [ , winerror [ , filename2 ] ] ] )\n\nThis exception is raised when a system function returns a system-related error, including I/O failures such as “file not found” or “disk full” (not for illegal argument types or other incidental errors).\n\nThe second form of the constructor sets the corresponding attributes, described below. The attributes default to None if not specified. For backwards compatibility, if three arguments are passed, the args attribute contains only a 2-tuple of the first two constructor arguments.\n\nThe constructor often actually returns a subclass of OSError , as described in OS exceptions below. The particular subclass depends on the final errno value. This behaviour only occurs when constructing OSError directly or via an alias, and is not inherited when subclassing.\n\nA numeric error code from the C variable errno .",
    "signature": "exception OSError ( [ arg ] ) ¶ exception OSError ( errno , strerror [ , filename [ , winerror [ , filename2 ] ] ] )",
    "url": "https://docs.python.org/3.13/library/exceptions.html#OSError"
  },
  "IOError": {
    "summary": "",
    "content": "exception IOError",
    "signature": "exception IOError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#IOError"
  },
  "RuntimeError": {
    "summary": "Raised when an error is detected that doesn’t fall in any of the other categories. The associated value is a string indicating what precisely went wrong.",
    "content": "exception RuntimeError\n\nRaised when an error is detected that doesn’t fall in any of the other categories. The associated value is a string indicating what precisely went wrong.",
    "signature": "exception RuntimeError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#RuntimeError"
  },
  "NotImplementedError": {
    "summary": "This exception is derived from RuntimeError . In user defined base classes, abstract methods should raise this exception when they require derived classes to override the method, or while the class is being developed to indicate that the real implementation still needs to be added.",
    "content": "exception NotImplementedError\n\nThis exception is derived from RuntimeError . In user defined base classes, abstract methods should raise this exception when they require derived classes to override the method, or while the class is being developed to indicate that the real implementation still needs to be added.\n\nIt should not be used to indicate that an operator or method is not meant to be supported at all – in that case either leave the operator / method undefined or, if a subclass, set it to None .",
    "signature": "exception NotImplementedError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#NotImplementedError"
  },
  "StopIteration": {
    "summary": "Raised by built-in function next() and an iterator 's __next__() method to signal that there are no further items produced by the iterator.",
    "content": "exception StopIteration\n\nRaised by built-in function next() and an iterator 's __next__() method to signal that there are no further items produced by the iterator.\n\nThe exception object has a single attribute value , which is given as an argument when constructing the exception, and defaults to None .",
    "signature": "exception StopIteration",
    "url": "https://docs.python.org/3.13/library/exceptions.html#StopIteration"
  },
  "StopAsyncIteration": {
    "summary": "Must be raised by __anext__() method of an asynchronous iterator object to stop the iteration.",
    "content": "exception StopAsyncIteration\n\nMust be raised by __anext__() method of an asynchronous iterator object to stop the iteration.\n\nAdded in version 3.5.",
    "signature": "exception StopAsyncIteration",
    "url": "https://docs.python.org/3.13/library/exceptions.html#StopAsyncIteration"
  },
  "GeneratorExit": {
    "summary": "Raised when a generator or coroutine is closed; see generator.close() and coroutine.close() . It directly inherits from BaseException instead of Exception since it is technically not an error.",
    "content": "exception GeneratorExit\n\nRaised when a generator or coroutine is closed; see generator.close() and coroutine.close() . It directly inherits from BaseException instead of Exception since it is technically not an error.",
    "signature": "exception GeneratorExit",
    "url": "https://docs.python.org/3.13/library/exceptions.html#GeneratorExit"
  },
  "ArithmeticError": {
    "summary": "The base class for those built-in exceptions that are raised for various arithmetic errors: OverflowError , ZeroDivisionError , FloatingPointError .",
    "content": "exception ArithmeticError\n\nThe base class for those built-in exceptions that are raised for various arithmetic errors: OverflowError , ZeroDivisionError , FloatingPointError .",
    "signature": "exception ArithmeticError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#ArithmeticError"
  },
  "ZeroDivisionError": {
    "summary": "Raised when the second argument of a division or modulo operation is zero. The associated value is a string indicating the type of the operands and the operation.",
    "content": "exception ZeroDivisionError\n\nRaised when the second argument of a division or modulo operation is zero. The associated value is a string indicating the type of the operands and the operation.",
    "signature": "exception ZeroDivisionError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#ZeroDivisionError"
  },
  "OverflowError": {
    "summary": "Raised when the result of an arithmetic operation is too large to be represented. This cannot occur for integers (which would rather raise MemoryError than give up). However, for historical reasons, OverflowError is sometimes raised for integers that are outside a required range. Because of the lack of standardization of floating-point exception handling in C, most floating-point operations are not checked.",
    "content": "exception OverflowError\n\nRaised when the result of an arithmetic operation is too large to be represented. This cannot occur for integers (which would rather raise MemoryError than give up). However, for historical reasons, OverflowError is sometimes raised for integers that are outside a required range. Because of the lack of standardization of floating-point exception handling in C, most floating-point operations are not checked.",
    "signature": "exception OverflowError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#OverflowError"
  },
  "FloatingPointError": {
    "summary": "Not currently used.",
    "content": "exception FloatingPointError\n\nNot currently used.",
    "signature": "exception FloatingPointError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#FloatingPointError"
  },
  "LookupError": {
    "summary": "The base class for the exceptions that are raised when a key or index used on a mapping or sequence is invalid: IndexError , KeyError . This can be raised directly by codecs.lookup() .",
    "content": "exception LookupError\n\nThe base class for the exceptions that are raised when a key or index used on a mapping or sequence is invalid: IndexError , KeyError . This can be raised directly by codecs.lookup() .",
    "signature": "exception LookupError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#LookupError"
  },
  "NameError": {
    "summary": "Raised when a local or global name is not found. This applies only to unqualified names. The associated value is an error message that includes the name that could not be found.",
    "content": "exception NameError\n\nRaised when a local or global name is not found. This applies only to unqualified names. The associated value is an error message that includes the name that could not be found.\n\nThe optional name keyword-only argument sets the attribute:\n\nThe name of the variable that was attempted to be accessed.",
    "signature": "exception NameError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#NameError"
  },
  "UnboundLocalError": {
    "summary": "Raised when a reference is made to a local variable in a function or method, but no value has been bound to that variable. This is a subclass of NameError .",
    "content": "exception UnboundLocalError\n\nRaised when a reference is made to a local variable in a function or method, but no value has been bound to that variable. This is a subclass of NameError .",
    "signature": "exception UnboundLocalError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#UnboundLocalError"
  },
  "SyntaxError": {
    "summary": "Raised when the parser encounters a syntax error. This may occur in an import statement, in a call to the built-in functions compile() , exec() , or eval() , or when reading the initial script or standard input (also interactively).",
    "content": "exception SyntaxError ( message , details )\n\nRaised when the parser encounters a syntax error. This may occur in an import statement, in a call to the built-in functions compile() , exec() , or eval() , or when reading the initial script or standard input (also interactively).\n\nThe str() of the exception instance returns only the error message. Details is a tuple whose members are also available as separate attributes.\n\nThe name of the file the syntax error occurred in.",
    "signature": "exception SyntaxError ( message , details )",
    "url": "https://docs.python.org/3.13/library/exceptions.html#SyntaxError"
  },
  "IndentationError": {
    "summary": "Base class for syntax errors related to incorrect indentation. This is a subclass of SyntaxError .",
    "content": "exception IndentationError\n\nBase class for syntax errors related to incorrect indentation. This is a subclass of SyntaxError .",
    "signature": "exception IndentationError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#IndentationError"
  },
  "TabError": {
    "summary": "Raised when indentation contains an inconsistent use of tabs and spaces. This is a subclass of IndentationError .",
    "content": "exception TabError\n\nRaised when indentation contains an inconsistent use of tabs and spaces. This is a subclass of IndentationError .",
    "signature": "exception TabError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#TabError"
  },
  "SystemError": {
    "summary": "Raised when the interpreter finds an internal error, but the situation does not look so serious to cause it to abandon all hope. The associated value is a string indicating what went wrong (in low-level terms). In CPython , this could be raised by incorrectly using Python’s C API, such as returning a NULL value without an exception set.",
    "content": "exception SystemError\n\nRaised when the interpreter finds an internal error, but the situation does not look so serious to cause it to abandon all hope. The associated value is a string indicating what went wrong (in low-level terms). In CPython , this could be raised by incorrectly using Python’s C API, such as returning a NULL value without an exception set.\n\nIf you’re confident that this exception wasn’t your fault, or the fault of a package you’re using, you should report this to the author or maintainer of your Python interpreter. Be sure to report the version of the Python interpreter ( sys.version ; it is also printed at the start of an interactive Python session), the exact error message (the exception’s associated value) and if possible the source of the program that triggered the error.",
    "signature": "exception SystemError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#SystemError"
  },
  "SystemExit": {
    "summary": "This exception is raised by the sys.exit() function. It inherits from BaseException instead of Exception so that it is not accidentally caught by code that catches Exception . This allows the exception to properly propagate up and cause the interpreter to exit. When it is not handled, the Python interpreter exits; no stack traceback is printed. The constructor accepts the same optional argument passed to sys.exit() . If the value is an integer, it specifies the system exit status (passed to C’s exit() function); if it is None , the exit status is zero; if it has another type (such as a string), the object’s value is printed and the exit status is one.",
    "content": "exception SystemExit\n\nThis exception is raised by the sys.exit() function. It inherits from BaseException instead of Exception so that it is not accidentally caught by code that catches Exception . This allows the exception to properly propagate up and cause the interpreter to exit. When it is not handled, the Python interpreter exits; no stack traceback is printed. The constructor accepts the same optional argument passed to sys.exit() . If the value is an integer, it specifies the system exit status (passed to C’s exit() function); if it is None , the exit status is zero; if it has another type (such as a string), the object’s value is printed and the exit status is one.\n\nA call to sys.exit() is translated into an exception so that clean-up handlers ( finally clauses of try statements) can be executed, and so that a debugger can execute a script without running the risk of losing control. The os._exit() function can be used if it is absolutely positively necessary to exit immediately (for example, in the child process after a call to os.fork() ).\n\nThe exit status or error message that is passed to the constructor. (Defaults to None .)",
    "signature": "exception SystemExit",
    "url": "https://docs.python.org/3.13/library/exceptions.html#SystemExit"
  },
  "UnicodeError": {
    "summary": "Raised when a Unicode-related encoding or decoding error occurs. It is a subclass of ValueError .",
    "content": "exception UnicodeError\n\nRaised when a Unicode-related encoding or decoding error occurs. It is a subclass of ValueError .\n\nUnicodeError has attributes that describe the encoding or decoding error. For example, err.object[err.start:err.end] gives the particular invalid input that the codec failed on.\n\nThe name of the encoding that raised the error.",
    "signature": "exception UnicodeError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#UnicodeError"
  },
  "UnicodeDecodeError": {
    "summary": "Raised when a Unicode-related error occurs during decoding. It is a subclass of UnicodeError .",
    "content": "exception UnicodeDecodeError\n\nRaised when a Unicode-related error occurs during decoding. It is a subclass of UnicodeError .",
    "signature": "exception UnicodeDecodeError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#UnicodeDecodeError"
  },
  "UnicodeEncodeError": {
    "summary": "Raised when a Unicode-related error occurs during encoding. It is a subclass of UnicodeError .",
    "content": "exception UnicodeEncodeError\n\nRaised when a Unicode-related error occurs during encoding. It is a subclass of UnicodeError .",
    "signature": "exception UnicodeEncodeError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#UnicodeEncodeError"
  },
  "RecursionError": {
    "summary": "This exception is derived from RuntimeError . It is raised when the interpreter detects that the maximum recursion depth (see sys.getrecursionlimit() ) is exceeded.",
    "content": "exception RecursionError\n\nThis exception is derived from RuntimeError . It is raised when the interpreter detects that the maximum recursion depth (see sys.getrecursionlimit() ) is exceeded.\n\nAdded in version 3.5: Previously, a plain RuntimeError was raised.",
    "signature": "exception RecursionError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#RecursionError"
  },
  "MemoryError": {
    "summary": "Raised when an operation runs out of memory but the situation may still be rescued (by deleting some objects). The associated value is a string indicating what kind of (internal) operation ran out of memory. Note that because of the underlying memory management architecture (C’s malloc() function), the interpreter may not always be able to completely recover from this situation; it nevertheless raises an exception so that a stack traceback can be printed, in case a run-away program was the cause.",
    "content": "exception MemoryError\n\nRaised when an operation runs out of memory but the situation may still be rescued (by deleting some objects). The associated value is a string indicating what kind of (internal) operation ran out of memory. Note that because of the underlying memory management architecture (C’s malloc() function), the interpreter may not always be able to completely recover from this situation; it nevertheless raises an exception so that a stack traceback can be printed, in case a run-away program was the cause.",
    "signature": "exception MemoryError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#MemoryError"
  },
  "ConnectionError": {
    "summary": "A base class for connection-related issues.",
    "content": "exception ConnectionError\n\nA base class for connection-related issues.\n\nSubclasses are BrokenPipeError , ConnectionAbortedError , ConnectionRefusedError and ConnectionResetError .",
    "signature": "exception ConnectionError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#ConnectionError"
  },
  "TimeoutError": {
    "summary": "Raised when a system function timed out at the system level. Corresponds to errno ETIMEDOUT .",
    "content": "exception TimeoutError\n\nRaised when a system function timed out at the system level. Corresponds to errno ETIMEDOUT .",
    "signature": "exception TimeoutError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#TimeoutError"
  },
  "EOFError": {
    "summary": "Raised when the input() function hits an end-of-file condition (EOF) without reading any data. (Note: the io.TextIOBase.read() and io.IOBase.readline() methods return an empty string when they hit EOF.)",
    "content": "exception EOFError\n\nRaised when the input() function hits an end-of-file condition (EOF) without reading any data. (Note: the io.TextIOBase.read() and io.IOBase.readline() methods return an empty string when they hit EOF.)",
    "signature": "exception EOFError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#EOFError"
  },
  "AssertionError": {
    "summary": "Raised when an assert statement fails.",
    "content": "exception AssertionError\n\nRaised when an assert statement fails.",
    "signature": "exception AssertionError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#AssertionError"
  },
  "BufferError": {
    "summary": "Raised when a buffer related operation cannot be performed.",
    "content": "exception BufferError\n\nRaised when a buffer related operation cannot be performed.",
    "signature": "exception BufferError",
    "url": "https://docs.python.org/3.13/library/exceptions.html#BufferError"
  },
  "Warning": {
    "summary": "Base class for warning categories.",
    "content": "exception Warning\n\nBase class for warning categories.",
    "signature": "exception Warning",
    "url": "https://docs.python.org/3.13/library/exceptions.html#Warning"
  },
  "DeprecationWarning": {
    "summary": "Base class for warnings about deprecated features when those warnings are intended for other Python developers.",
    "content": "exception DeprecationWarning\n\nBase class for warnings about deprecated features when those warnings are intended for other Python developers.\n\nIgnored by the default warning filters, except in the __main__ module ( PEP 565 ). Enabling the Python Development Mode shows this warning.\n\nThe deprecation policy is described in PEP 387 .",
    "signature": "exception DeprecationWarning",
    "url": "https://docs.python.org/3.13/library/exceptions.html#DeprecationWarning"
  },
  "FutureWarning": {
    "summary": "Base class for warnings about deprecated features when those warnings are intended for end users of applications that are written in Python.",
    "content": "exception FutureWarning\n\nBase class for warnings about deprecated features when those warnings are intended for end users of applications that are written in Python.",
    "signature": "exception FutureWarning",
    "url": "https://docs.python.org/3.13/library/exceptions.html#FutureWarning"
  },
  "UserWarning": {
    "summary": "Base class for warnings generated by user code.",
    "content": "exception UserWarning\n\nBase class for warnings generated by user code.",
    "signature": "exception UserWarning",
    "url": "https://docs.python.org/3.13/library/exceptions.html#UserWarning"
  },
  "dataclasses.dataclass": {
    "summary": "This function is a decorator that is used to add generated special methods to classes, as described below.",
    "content": "@ dataclasses. dataclass ( * , init = True , repr = True , eq = True , order = False , unsafe_hash = False , frozen = False , match_args = True , kw_only = False , slots = False , weakref_slot = False )\n\nThis function is a decorator that is used to add generated special methods to classes, as described below.\n\nThe @dataclass decorator examines the class to find field s. A field is defined as a class variable that has a type annotation . With two exceptions described below, nothing in @dataclass examines the type specified in the variable annotation.\n\nThe order of the fields in all of the generated methods is the order in which they appear in the class definition.\n\nThe @dataclass decorator will add various “dunder” methods to the class, described below. If any of the added methods already exist in the class, the behavior depends on the parameter, as documented below. The decorator returns the same class that it is called on; no new class is created.\n\n```python\n@dataclass class C : ... @dataclass () class C : ... @dataclass ( init = True , repr = True , eq = True , order = False , unsafe_hash = False , frozen = False , match_args = True , kw_only = False , slots = False , weakref_slot = False ) class C : ...\n```\n\n```python\n@dataclass class C : a : int # 'a' has no default value b : int = 0 # assign a default value for 'b'\n```",
    "signature": "@ dataclasses. dataclass ( * , init = True , repr = True , eq = True , order = False , unsafe_hash = False , frozen = False , match_args = True , kw_only = False , slots = False , weakref_slot = False )",
    "url": "https://docs.python.org/3.13/library/dataclasses.html#dataclasses.dataclass"
  },
  "dataclasses.field": {
    "summary": "For common and simple use cases, no other functionality is required. There are, however, some dataclass features that require additional per-field information. To satisfy this need for additional information, you can replace the default field value with a call to the provided field() function. For example:",
    "content": "dataclasses. field ( * , default = MISSING , default_factory = MISSING , init = True , repr = True , hash = None , compare = True , metadata = None , kw_only = MISSING )\n\nFor common and simple use cases, no other functionality is required. There are, however, some dataclass features that require additional per-field information. To satisfy this need for additional information, you can replace the default field value with a call to the provided field() function. For example:\n\n@dataclass class C : mylist : list [ int ] = field ( default_factory = list ) c = C () c . mylist += [ 1 , 2 , 3 ] As shown above, the MISSING value is a sentinel object used to detect if some parameters are provided by the user. This sentinel is used because None is a valid value for some parameters with a distinct meaning. No code should directly use the MISSING value.\n\nThe parameters to field() are:\n\ndefault : If provided, this will be the default value for this field. This is needed because the field() call itself replaces the normal position of the default value.\n\n```python\n@dataclass class C : mylist : list [ int ] = field ( default_factory = list ) c = C () c . mylist += [ 1 , 2 , 3 ]\n```\n\n```python\n@dataclass class C : x : int y : int = field ( repr = False ) z : int = field ( repr = False , default = 10 ) t : int = 20\n```",
    "signature": "dataclasses. field ( * , default = MISSING , default_factory = MISSING , init = True , repr = True , hash = None , compare = True , metadata = None , kw_only = MISSING )",
    "url": "https://docs.python.org/3.13/library/dataclasses.html#dataclasses.field"
  },
  "lambda": {
    "summary": "lambda_expr ::= \"lambda\" [ parameter_list ] \":\" expression Lambda expressions (sometimes called lambda forms) are used to create anonymous functions. The expression lambda parameters: expression yields a function object. The unnamed object behaves like a function object defined with:",
    "content": "**6.14. Lambdas**\n\nlambda_expr ::= \"lambda\" [ parameter_list ] \":\" expression Lambda expressions (sometimes called lambda forms) are used to create anonymous functions. The expression lambda parameters: expression yields a function object. The unnamed object behaves like a function object defined with:\n\ndef <lambda>(parameters): return expression See section Function definitions for the syntax of parameter lists. Note that functions created with lambda expressions cannot contain statements or annotations.",
    "url": "https://docs.python.org/3.13/reference/expressions.html#lambda"
  },
  "await": {
    "summary": "Suspend the execution of coroutine on an awaitable object. Can only be used inside a coroutine function .",
    "content": "**6.4. Await expression**\n\nSuspend the execution of coroutine on an awaitable object. Can only be used inside a coroutine function .\n\nawait_expr ::= \"await\" primary Added in version 3.5.",
    "url": "https://docs.python.org/3.13/reference/expressions.html#await-expression"
  },
  "in": {
    "summary": "The operators in and not in test for membership. x in s evaluates to True if x is a member of s , and False otherwise.",
    "content": "**6.10.2. Membership test operations**\n\nThe operators in and not in test for membership. x in s evaluates to True if x is a member of s , and False otherwise. x not in s returns the negation of x in s . All built-in sequences and set types support this as well as dictionary, for which in tests whether the dictionary has a given key. For container types such as list, tuple, set, frozenset, dict, or collections.deque, the expression x in y is equivalent to any(x is e or x == e for e in y) .\n\nFor the string and bytes types, x in y is True if and only if x is a substring of y . An equivalent test is y.find(x) != -1 . Empty strings are always considered to be a substring of any other string, so \"\" in \"abc\" will return True .\n\nFor user-defined classes which define the __contains__() method, x in y returns True if y.__contains__(x) returns a true value, and False otherwise.\n\nFor user-defined classes which do not define __contains__() but do define __iter__() , x in y is True if some value z , for which the expression x is z or x == z is true, is produced while iterating over y . If an exception is raised during the iteration, it is as if in raised that exception.\n\nLastly, the old-style iteration protocol is tried: if a class defines __getitem__() , x in y is True if and only if there is a non-negative integer index i such that x is y[i] or x == y[i] , and no lower integer index raises the IndexError exception. (If any other exception is raised, it is as if in raised that exception).",
    "url": "https://docs.python.org/3.13/reference/expressions.html#membership-test-operations"
  },
  "is": {
    "summary": "The operators is and is not test for an object’s identity: x is y is true if and only if x and y are the same object. An Object’s identity is determined using the id() function. x is not y yields the inverse truth value. [ 4 ]",
    "content": "The operators is and is not test for an object’s identity: x is y is true if and only if x and y are the same object. An Object’s identity is determined using the id() function. x is not y yields the inverse truth value. [ 4 ]\n\nor_test ::= and_test | or_test \"or\" and_test and_test ::= not_test | and_test \"and\" not_test not_test ::= comparison | \"not\" not_test In the context of Boolean operations, and also when expressions are used by control flow statements, the following values are interpreted as false: False , None , numeric zero of all types, and empty strings and containers (including strings, tuples, lists, dictionaries, sets and frozensets). All other values are interpreted as true. User-defined objects can customize their truth value by providing a __bool__() method.\n\nThe operator not yields True if its argument is false, False otherwise.",
    "url": "https://docs.python.org/3.13/reference/expressions.html#is"
  },
  "not": {
    "summary": "or_test ::= and_test | or_test \"or\" and_test and_test ::= not_test | and_test \"and\" not_test not_test ::= comparison | \"not\" not_test In the context of Boolean operations, and also when expressions are used by control flow statements, the following values are interpreted as false: False , None , numeric zero of all types, and empty strings and containers (including strings, tuples, lists, dictionaries, sets and frozensets). All other values are interpreted as true. User-defined objects can customize their truth value by providing a __bool__() method.",
    "content": "or_test ::= and_test | or_test \"or\" and_test and_test ::= not_test | and_test \"and\" not_test not_test ::= comparison | \"not\" not_test In the context of Boolean operations, and also when expressions are used by control flow statements, the following values are interpreted as false: False , None , numeric zero of all types, and empty strings and containers (including strings, tuples, lists, dictionaries, sets and frozensets). All other values are interpreted as true. User-defined objects can customize their truth value by providing a __bool__() method.\n\nThe operator not yields True if its argument is false, False otherwise.\n\nThe expression x and y first evaluates x ; if x is false, its value is returned; otherwise, y is evaluated and the resulting value is returned.",
    "url": "https://docs.python.org/3.13/reference/expressions.html#not"
  },
  "and": {
    "summary": "or_test ::= and_test | or_test \"or\" and_test and_test ::= not_test | and_test \"and\" not_test not_test ::= comparison | \"not\" not_test In the context of Boolean operations, and also when expressions are used by control flow statements, the following values are interpreted as false: False , None , numeric zero of all types, and empty strings and containers (including strings, tuples, lists, dictionaries, sets and frozensets). All other values are interpreted as true. User-defined objects can customize their truth value by providing a __bool__() method.",
    "content": "or_test ::= and_test | or_test \"or\" and_test and_test ::= not_test | and_test \"and\" not_test not_test ::= comparison | \"not\" not_test In the context of Boolean operations, and also when expressions are used by control flow statements, the following values are interpreted as false: False , None , numeric zero of all types, and empty strings and containers (including strings, tuples, lists, dictionaries, sets and frozensets). All other values are interpreted as true. User-defined objects can customize their truth value by providing a __bool__() method.\n\nThe operator not yields True if its argument is false, False otherwise.\n\nThe expression x and y first evaluates x ; if x is false, its value is returned; otherwise, y is evaluated and the resulting value is returned.",
    "url": "https://docs.python.org/3.13/reference/expressions.html#and"
  },
  "or": {
    "summary": "or_test ::= and_test | or_test \"or\" and_test and_test ::= not_test | and_test \"and\" not_test not_test ::= comparison | \"not\" not_test In the context of Boolean operations, and also when expressions are used by control flow statements, the following values are interpreted as false: False , None , numeric zero of all types, and empty strings and containers (including strings, tuples, lists, dictionaries, sets and frozensets). All other values are interpreted as true. User-defined objects can customize their truth value by providing a __bool__() method.",
    "content": "or_test ::= and_test | or_test \"or\" and_test and_test ::= not_test | and_test \"and\" not_test not_test ::= comparison | \"not\" not_test In the context of Boolean operations, and also when expressions are used by control flow statements, the following values are interpreted as false: False , None , numeric zero of all types, and empty strings and containers (including strings, tuples, lists, dictionaries, sets and frozensets). All other values are interpreted as true. User-defined objects can customize their truth value by providing a __bool__() method.\n\nThe operator not yields True if its argument is false, False otherwise.\n\nThe expression x and y first evaluates x ; if x is false, its value is returned; otherwise, y is evaluated and the resulting value is returned.",
    "url": "https://docs.python.org/3.13/reference/expressions.html#or"
  },
  "functools.wraps": {
    "summary": "This is a convenience function for invoking update_wrapper() as a function decorator when defining a wrapper function. It is equivalent to partial(update_wrapper, wrapped=wrapped, assigned=assigned, updated=updated) . For example:",
    "content": "@ functools. wraps ( wrapped , assigned = WRAPPER_ASSIGNMENTS , updated = WRAPPER_UPDATES )\n\nThis is a convenience function for invoking update_wrapper() as a function decorator when defining a wrapper function. It is equivalent to partial(update_wrapper, wrapped=wrapped, assigned=assigned, updated=updated) . For example:\n\n>>> from functools import wraps >>> def my_decorator ( f ): ... @wraps ( f ) ... def wrapper ( * args , ** kwds ): ... print ( 'Calling decorated function' ) ... return f ( * args , ** kwds ) ... return wrapper ... >>> @my_decorator ... def example (): ... \"\"\"Docstring\"\"\" ... print ( 'Called example function' ) ... >>> example () Calling decorated function Called example function >>> example . __name__ 'example' >>> example . __doc__ 'Docstring' Without the use of this decorator factory, the name of the example function would have been 'wrapper' , and the docstring of the original example() would have been lost.\n\n```python\n>>> from functools import wraps >>> def my_decorator ( f ): ... @wraps ( f ) ... def wrapper ( * args , ** kwds ): ... print ( 'Calling decorated function' ) ... return f ( * args , ** kwds ) ... return wrapper ... >>> @my_decorator ... def example (): ... \"\"\"Docstring\"\"\" ... print ( 'Called example function' ) ... >>> example () Calling decorated function Called example function >>> example . __name__ 'example' >>> example . __doc__ 'Docstring'\n```",
    "signature": "@ functools. wraps ( wrapped , assigned = WRAPPER_ASSIGNMENTS , updated = WRAPPER_UPDATES )",
    "url": "https://docs.python.org/3.13/library/functools.html#functools.wraps"
  },
  "functools.lru_cache": {
    "summary": "Decorator to wrap a function with a memoizing callable that saves up to the maxsize most recent calls. It can save time when an expensive or I/O bound function is periodically called with the same arguments.",
    "content": "@ functools. lru_cache ( user_function ) ¶ @ functools. lru_cache ( maxsize = 128 , typed = False )\n\nDecorator to wrap a function with a memoizing callable that saves up to the maxsize most recent calls. It can save time when an expensive or I/O bound function is periodically called with the same arguments.\n\nThe cache is threadsafe so that the wrapped function can be used in multiple threads. This means that the underlying data structure will remain coherent during concurrent updates.\n\nIt is possible for the wrapped function to be called more than once if another thread makes an additional call before the initial call has been completed and cached.\n\nSince a dictionary is used to cache results, the positional and keyword arguments to the function must be hashable .\n\n```python\n@lru_cache def count_vowels ( sentence ): return sum ( sentence . count ( vowel ) for vowel in 'AEIOUaeiou' )\n```",
    "signature": "@ functools. lru_cache ( user_function ) ¶ @ functools. lru_cache ( maxsize = 128 , typed = False )",
    "url": "https://docs.python.org/3.13/library/functools.html#functools.lru_cache"
  },
  "functools.partial": {
    "summary": "Return a new partial object which when called will behave like func called with the positional arguments args and keyword arguments keywords . If more arguments are supplied to the call, they are appended to args . If additional keyword arguments are supplied, they extend and override keywords . Roughly equivalent to:",
    "content": "functools. partial ( func , / , * args , ** keywords )\n\nReturn a new partial object which when called will behave like func called with the positional arguments args and keyword arguments keywords . If more arguments are supplied to the call, they are appended to args . If additional keyword arguments are supplied, they extend and override keywords . Roughly equivalent to:\n\ndef partial ( func , / , * args , ** keywords ): def newfunc ( * fargs , ** fkeywords ): newkeywords = { ** keywords , ** fkeywords } return func ( * args , * fargs , ** newkeywords ) newfunc . func = func newfunc . args = args newfunc . keywords = keywords return newfunc The partial() is used for partial function application which “freezes” some portion of a function’s arguments and/or keywords resulting in a new object with a simplified signature. For example, partial() can be used to create a callable that behaves like the int() function where the base argument defaults to two:\n\n```python\ndef partial ( func , / , * args , ** keywords ): def newfunc ( * fargs , ** fkeywords ): newkeywords = { ** keywords , ** fkeywords } return func ( * args , * fargs , ** newkeywords ) newfunc . func = func newfunc . args = args newfunc . keywords = keywords return newfunc\n```\n\n```python\n>>> from functools import partial >>> basetwo = partial ( int , base = 2 ) >>> basetwo . __doc__ = 'Convert base 2 string to an int.' >>> basetwo ( '10010' ) 18\n```",
    "signature": "functools. partial ( func , / , * args , ** keywords )",
    "url": "https://docs.python.org/3.13/library/functools.html#functools.partial"
  },
  "functools.reduce": {
    "summary": "Apply function of two arguments cumulatively to the items of iterable , from left to right, so as to reduce the iterable to a single value. For example, reduce(lambda x, y: x+y, [1, 2, 3, 4, 5]) calculates ((((1+2)+3)+4)+5) . The left argument, x , is the accumulated value and the right argument, y , is the update value from the iterable . If the optional initial is present, it is placed before the items of the iterable in the calculation, and serves as a default when the iterable is empty. If initial is not given and iterable contains only one item, the first item is returned.",
    "content": "functools. reduce ( function , iterable , [ initial , ] / )\n\nApply function of two arguments cumulatively to the items of iterable , from left to right, so as to reduce the iterable to a single value. For example, reduce(lambda x, y: x+y, [1, 2, 3, 4, 5]) calculates ((((1+2)+3)+4)+5) . The left argument, x , is the accumulated value and the right argument, y , is the update value from the iterable . If the optional initial is present, it is placed before the items of the iterable in the calculation, and serves as a default when the iterable is empty. If initial is not given and iterable contains only one item, the first item is returned.\n\nRoughly equivalent to:\n\ninitial_missing = object () def reduce ( function , iterable , initial = initial_missing , / ): it = iter ( iterable ) if initial is initial_missing : value = next ( it ) else : value = initial for element in it : value = function ( value , element ) return value See itertools.accumulate() for an iterator that yields all intermediate values.\n\n```python\ninitial_missing = object () def reduce ( function , iterable , initial = initial_missing , / ): it = iter ( iterable ) if initial is initial_missing : value = next ( it ) else : value = initial for element in it : value = function ( value , element ) return value\n```",
    "signature": "functools. reduce ( function , iterable , [ initial , ] / )",
    "url": "https://docs.python.org/3.13/library/functools.html#functools.reduce"
  },
  "functools.cache": {
    "summary": "Simple lightweight unbounded function cache. Sometimes called “memoize” .",
    "content": "@ functools. cache ( user_function )\n\nSimple lightweight unbounded function cache. Sometimes called “memoize” .\n\nReturns the same as lru_cache(maxsize=None) , creating a thin wrapper around a dictionary lookup for the function arguments. Because it never needs to evict old values, this is smaller and faster than lru_cache() with a size limit.\n\nFor example:\n\n@cache def factorial ( n ): return n * factorial ( n - 1 ) if n else 1 >>> factorial ( 10 ) # no previously cached result, makes 11 recursive calls 3628800 >>> factorial ( 5 ) # no new calls, just returns the cached result 120 >>> factorial ( 12 ) # two new recursive calls, factorial(10) is cached 479001600 The cache is threadsafe so that the wrapped function can be used in multiple threads. This means that the underlying data structure will remain coherent during concurrent updates.\n\n```python\n@cache def factorial ( n ): return n * factorial ( n - 1 ) if n else 1 >>> factorial ( 10 ) # no previously cached result, makes 11 recursive calls 3628800 >>> factorial ( 5 ) # no new calls, just returns the cached result 120 >>> factorial ( 12 ) # two new recursive calls, factorial(10) is cached 479001600\n```",
    "signature": "@ functools. cache ( user_function )",
    "url": "https://docs.python.org/3.13/library/functools.html#functools.cache"
  },
  "collections.defaultdict": {
    "summary": "Return a new dictionary-like object. defaultdict is a subclass of the built-in dict class. It overrides one method and adds one writable instance variable. The remaining functionality is the same as for the dict class and is not documented here.",
    "content": "class collections. defaultdict ( default_factory=None , / [ , ... ] )\n\nReturn a new dictionary-like object. defaultdict is a subclass of the built-in dict class. It overrides one method and adds one writable instance variable. The remaining functionality is the same as for the dict class and is not documented here.\n\nThe first argument provides the initial value for the default_factory attribute; it defaults to None . All remaining arguments are treated the same as if they were passed to the dict constructor, including keyword arguments.\n\ndefaultdict objects support the following method in addition to the standard dict operations:\n\nIf the default_factory attribute is None , this raises a KeyError exception with the key as argument.",
    "signature": "class collections. defaultdict ( default_factory=None , / [ , ... ] )",
    "url": "https://docs.python.org/3.13/library/collections.html#collections.defaultdict"
  },
  "collections.OrderedDict": {
    "summary": "Return an instance of a dict subclass that has methods specialized for rearranging dictionary order.",
    "content": "class collections. OrderedDict ( [ items ] )\n\nReturn an instance of a dict subclass that has methods specialized for rearranging dictionary order.\n\nAdded in version 3.1.\n\nThe popitem() method for ordered dictionaries returns and removes a (key, value) pair. The pairs are returned in LIFO order if last is true or FIFO order if false.",
    "signature": "class collections. OrderedDict ( [ items ] )",
    "url": "https://docs.python.org/3.13/library/collections.html#collections.OrderedDict"
  },
  "collections.Counter": {
    "summary": "A Counter is a dict subclass for counting hashable objects. It is a collection where elements are stored as dictionary keys and their counts are stored as dictionary values. Counts are allowed to be any integer value including zero or negative counts. The Counter class is similar to bags or multisets in other languages.",
    "content": "class collections. Counter ( [ iterable-or-mapping ] )\n\nA Counter is a dict subclass for counting hashable objects. It is a collection where elements are stored as dictionary keys and their counts are stored as dictionary values. Counts are allowed to be any integer value including zero or negative counts. The Counter class is similar to bags or multisets in other languages.\n\nElements are counted from an iterable or initialized from another mapping (or counter):\n\n>>> c = Counter () # a new, empty counter >>> c = Counter ( 'gallahad' ) # a new counter from an iterable >>> c = Counter ({ 'red' : 4 , 'blue' : 2 }) # a new counter from a mapping >>> c = Counter ( cats = 4 , dogs = 8 ) # a new counter from keyword args Counter objects have a dictionary interface except that they return a zero count for missing items instead of raising a KeyError :\n\n>>> c = Counter ([ 'eggs' , 'ham' ]) >>> c [ 'bacon' ] # count of a missing element is zero 0 Setting a count to zero does not remove an element from a counter. Use del to remove it entirely:\n\n```python\n>>> c = Counter () # a new, empty counter >>> c = Counter ( 'gallahad' ) # a new counter from an iterable >>> c = Counter ({ 'red' : 4 , 'blue' : 2 }) # a new counter from a mapping >>> c = Counter ( cats = 4 , dogs = 8 ) # a new counter from keyword args\n```\n\n```python\n>>> c = Counter ([ 'eggs' , 'ham' ]) >>> c [ 'bacon' ] # count of a missing element is zero 0\n```",
    "signature": "class collections. Counter ( [ iterable-or-mapping ] )",
    "url": "https://docs.python.org/3.13/library/collections.html#collections.Counter"
  },
  "collections.namedtuple": {
    "summary": "Returns a new tuple subclass named typename . The new subclass is used to create tuple-like objects that have fields accessible by attribute lookup as well as being indexable and iterable. Instances of the subclass also have a helpful docstring (with typename and field_names ) and a helpful __repr__() method which lists the tuple contents in a name=value format.",
    "content": "collections. namedtuple ( typename , field_names , * , rename = False , defaults = None , module = None )\n\nReturns a new tuple subclass named typename . The new subclass is used to create tuple-like objects that have fields accessible by attribute lookup as well as being indexable and iterable. Instances of the subclass also have a helpful docstring (with typename and field_names ) and a helpful __repr__() method which lists the tuple contents in a name=value format.\n\nThe field_names are a sequence of strings such as ['x', 'y'] . Alternatively, field_names can be a single string with each fieldname separated by whitespace and/or commas, for example 'x y' or 'x, y' .\n\nAny valid Python identifier may be used for a fieldname except for names starting with an underscore. Valid identifiers consist of letters, digits, and underscores but do not start with a digit or underscore and cannot be a keyword such as class , for , return , global , pass , or raise .\n\nIf rename is true, invalid fieldnames are automatically replaced with positional names. For example, ['abc', 'def', 'ghi', 'abc'] is converted to ['abc', '_1', 'ghi', '_3'] , eliminating the keyword def and the duplicate fieldname abc .",
    "signature": "collections. namedtuple ( typename , field_names , * , rename = False , defaults = None , module = None )",
    "url": "https://docs.python.org/3.13/library/collections.html#collections.namedtuple"
  },
  "collections.deque": {
    "summary": "Returns a new deque object initialized left-to-right (using append() ) with data from iterable . If iterable is not specified, the new deque is empty.",
    "content": "class collections. deque ( [ iterable [ , maxlen ] ] )\n\nReturns a new deque object initialized left-to-right (using append() ) with data from iterable . If iterable is not specified, the new deque is empty.\n\nDeques are a generalization of stacks and queues (the name is pronounced “deck” and is short for “double-ended queue”). Deques support thread-safe, memory efficient appends and pops from either side of the deque with approximately the same O (1) performance in either direction.\n\nThough list objects support similar operations, they are optimized for fast fixed-length operations and incur O ( n ) memory movement costs for pop(0) and insert(0, v) operations which change both the size and position of the underlying data representation.\n\nIf maxlen is not specified or is None , deques may grow to an arbitrary length. Otherwise, the deque is bounded to the specified maximum length. Once a bounded length deque is full, when new items are added, a corresponding number of items are discarded from the opposite end. Bounded length deques provide functionality similar to the tail filter in Unix. They are also useful for tracking transactions and other pools of data where only the most recent activity is of interest.",
    "signature": "class collections. deque ( [ iterable [ , maxlen ] ] )",
    "url": "https://docs.python.org/3.13/library/collections.html#collections.deque"
  },
  "collections.abc.Iterable": {
    "summary": "ABC for classes that provide the __iter__() method.",
    "content": "class collections.abc. Iterable\n\nABC for classes that provide the __iter__() method.\n\nChecking isinstance(obj, Iterable) detects classes that are registered as Iterable or that have an __iter__() method, but it does not detect classes that iterate with the __getitem__() method. The only reliable way to determine whether an object is iterable is to call iter(obj) .",
    "signature": "class collections.abc. Iterable",
    "url": "https://docs.python.org/3.13/library/collections.abc.html#collections.abc.Iterable"
  },
  "collections.abc.Iterator": {
    "summary": "ABC for classes that provide the __iter__() and __next__() methods. See also the definition of iterator .",
    "content": "class collections.abc. Iterator\n\nABC for classes that provide the __iter__() and __next__() methods. See also the definition of iterator .",
    "signature": "class collections.abc. Iterator",
    "url": "https://docs.python.org/3.13/library/collections.abc.html#collections.abc.Iterator"
  },
  "collections.abc.Generator": {
    "summary": "ABC for generator classes that implement the protocol defined in PEP 342 that extends iterators with the send() , throw() and close() methods.",
    "content": "class collections.abc. Generator\n\nABC for generator classes that implement the protocol defined in PEP 342 that extends iterators with the send() , throw() and close() methods.\n\nSee Annotating generators and coroutines for details on using Generator in type annotations.\n\nAdded in version 3.5.",
    "signature": "class collections.abc. Generator",
    "url": "https://docs.python.org/3.13/library/collections.abc.html#collections.abc.Generator"
  },
  "collections.abc.Callable": {
    "summary": "ABC for classes that provide the __call__() method.",
    "content": "class collections.abc. Callable\n\nABC for classes that provide the __call__() method.\n\nSee Annotating callable objects for details on how to use Callable in type annotations.",
    "signature": "class collections.abc. Callable",
    "url": "https://docs.python.org/3.13/library/collections.abc.html#collections.abc.Callable"
  },
  "collections.abc.Sequence": {
    "summary": "ABCs for read-only and mutable sequences .",
    "content": "class collections.abc. Sequence ¶ class collections.abc. MutableSequence ¶ class collections.abc. ByteString\n\nABCs for read-only and mutable sequences .\n\nImplementation note: Some of the mixin methods, such as __iter__() , __reversed__() , and index() make repeated calls to the underlying __getitem__() method. Consequently, if __getitem__() is implemented with constant access speed, the mixin methods will have linear performance; however, if the underlying method is linear (as it would be with a linked list), the mixins will have quadratic performance and will likely need to be overridden.\n\nReturn first index of value .\n\nRaises ValueError if the value is not present.",
    "signature": "class collections.abc. Sequence ¶ class collections.abc. MutableSequence ¶ class collections.abc. ByteString",
    "url": "https://docs.python.org/3.13/library/collections.abc.html#collections.abc.Sequence"
  },
  "collections.abc.Mapping": {
    "summary": "ABCs for read-only and mutable mappings .",
    "content": "class collections.abc. Mapping ¶ class collections.abc. MutableMapping\n\nABCs for read-only and mutable mappings .",
    "signature": "class collections.abc. Mapping ¶ class collections.abc. MutableMapping",
    "url": "https://docs.python.org/3.13/library/collections.abc.html#collections.abc.Mapping"
  },
  "itertools.chain": {
    "summary": "Make an iterator that returns elements from the first iterable until it is exhausted, then proceeds to the next iterable, until all of the iterables are exhausted. This combines multiple data sources into a single iterator. Roughly equivalent to:",
    "content": "itertools. chain ( * iterables )\n\nMake an iterator that returns elements from the first iterable until it is exhausted, then proceeds to the next iterable, until all of the iterables are exhausted. This combines multiple data sources into a single iterator. Roughly equivalent to:\n\n```python\ndef chain ( * iterables ): # chain('ABC', 'DEF') → A B C D E F for iterable in iterables : yield from iterable\n```",
    "signature": "itertools. chain ( * iterables )",
    "url": "https://docs.python.org/3.13/library/itertools.html#itertools.chain"
  },
  "itertools.product": {
    "summary": "Cartesian product of the input iterables.",
    "content": "itertools. product ( * iterables , repeat = 1 )\n\nCartesian product of the input iterables.\n\nRoughly equivalent to nested for-loops in a generator expression. For example, product(A, B) returns the same as ((x,y) for x in A for y in B) .\n\nThe nested loops cycle like an odometer with the rightmost element advancing on every iteration. This pattern creates a lexicographic ordering so that if the input’s iterables are sorted, the product tuples are emitted in sorted order.\n\nTo compute the product of an iterable with itself, specify the number of repetitions with the optional repeat keyword argument. For example, product(A, repeat=4) means the same as product(A, A, A, A) .\n\n```python\ndef product ( * iterables , repeat = 1 ): # product('ABCD', 'xy') → Ax Ay Bx By Cx Cy Dx Dy # product(range(2), repeat=3) → 000 001 010 011 100 101 110 111 if repeat < 0 : raise ValueError ( 'repeat argument cannot be negative' ) pools = [ tuple ( pool ) for pool in iterables ] * repeat result = [[]] for pool in pools : result = [ x + [ y ] for x in result for y in pool ] for prod in result : yield tuple ( prod )\n```",
    "signature": "itertools. product ( * iterables , repeat = 1 )",
    "url": "https://docs.python.org/3.13/library/itertools.html#itertools.product"
  },
  "itertools.combinations": {
    "summary": "Return r length subsequences of elements from the input iterable .",
    "content": "itertools. combinations ( iterable , r )\n\nReturn r length subsequences of elements from the input iterable .\n\nThe output is a subsequence of product() keeping only entries that are subsequences of the iterable . The length of the output is given by math.comb() which computes n! / r! / (n - r)! when 0 ≤ r ≤ n or zero when r > n .\n\nThe combination tuples are emitted in lexicographic order according to the order of the input iterable . If the input iterable is sorted, the output tuples will be produced in sorted order.\n\nElements are treated as unique based on their position, not on their value. If the input elements are unique, there will be no repeated values within each combination.\n\n```python\ndef combinations ( iterable , r ): # combinations('ABCD', 2) → AB AC AD BC BD CD # combinations(range(4), 3) → 012 013 023 123 pool = tuple ( iterable ) n = len ( pool ) if r > n : return indices = list ( range ( r )) yield tuple ( pool [ i ] for i in indices ) while True : for i in reversed ( range ( r )): if indices [ i ] != i + n - r : break else : return indices [ i ] += 1 for j in range ( i + 1 , r ): indices [ j ] = indices [ j - 1 ] + 1 yield tuple ( pool [ i ] for i in indices )\n```",
    "signature": "itertools. combinations ( iterable , r )",
    "url": "https://docs.python.org/3.13/library/itertools.html#itertools.combinations"
  },
  "itertools.permutations": {
    "summary": "Return successive r length permutations of elements from the iterable .",
    "content": "itertools. permutations ( iterable , r = None )\n\nReturn successive r length permutations of elements from the iterable .\n\nIf r is not specified or is None , then r defaults to the length of the iterable and all possible full-length permutations are generated.\n\nThe output is a subsequence of product() where entries with repeated elements have been filtered out. The length of the output is given by math.perm() which computes n! / (n - r)! when 0 ≤ r ≤ n or zero when r > n .\n\nThe permutation tuples are emitted in lexicographic order according to the order of the input iterable . If the input iterable is sorted, the output tuples will be produced in sorted order.",
    "signature": "itertools. permutations ( iterable , r = None )",
    "url": "https://docs.python.org/3.13/library/itertools.html#itertools.permutations"
  },
  "itertools.groupby": {
    "summary": "Make an iterator that returns consecutive keys and groups from the iterable . The key is a function computing a key value for each element. If not specified or is None , key defaults to an identity function and returns the element unchanged. Generally, the iterable needs to already be sorted on the same key function.",
    "content": "itertools. groupby ( iterable , key = None )\n\nMake an iterator that returns consecutive keys and groups from the iterable . The key is a function computing a key value for each element. If not specified or is None , key defaults to an identity function and returns the element unchanged. Generally, the iterable needs to already be sorted on the same key function.\n\nThe operation of groupby() is similar to the uniq filter in Unix. It generates a break or new group every time the value of the key function changes (which is why it is usually necessary to have sorted the data using the same key function). That behavior differs from SQL’s GROUP BY which aggregates common elements regardless of their input order.\n\nThe returned group is itself an iterator that shares the underlying iterable with groupby() . Because the source is shared, when the groupby() object is advanced, the previous group is no longer visible. So, if that data is needed later, it should be stored as a list:\n\ngroups = [] uniquekeys = [] data = sorted ( data , key = keyfunc ) for k , g in groupby ( data , keyfunc ): groups . append ( list ( g )) # Store group iterator as a list uniquekeys . append ( k ) groupby() is roughly equivalent to:\n\n```python\ngroups = [] uniquekeys = [] data = sorted ( data , key = keyfunc ) for k , g in groupby ( data , keyfunc ): groups . append ( list ( g )) # Store group iterator as a list uniquekeys . append ( k )\n```",
    "signature": "itertools. groupby ( iterable , key = None )",
    "url": "https://docs.python.org/3.13/library/itertools.html#itertools.groupby"
  },
  "pathlib.Path": {
    "summary": "A subclass of PurePath , this class represents concrete paths of the system’s path flavour (instantiating it creates either a PosixPath or a WindowsPath ):",
    "content": "class pathlib. Path ( * pathsegments )\n\nA subclass of PurePath , this class represents concrete paths of the system’s path flavour (instantiating it creates either a PosixPath or a WindowsPath ):\n\n>>> Path ( 'setup.py' ) PosixPath('setup.py') pathsegments is specified similarly to PurePath .\n\n```python\n>>> Path ( 'setup.py' ) PosixPath('setup.py')\n```",
    "signature": "class pathlib. Path ( * pathsegments )",
    "url": "https://docs.python.org/3.13/library/pathlib.html#pathlib.Path"
  },
  "pathlib.PurePath": {
    "summary": "A generic class that represents the system’s path flavour (instantiating it creates either a PurePosixPath or a PureWindowsPath ):",
    "content": "class pathlib. PurePath ( * pathsegments )\n\nA generic class that represents the system’s path flavour (instantiating it creates either a PurePosixPath or a PureWindowsPath ):\n\n>>> PurePath ( 'setup.py' ) # Running on a Unix machine PurePosixPath('setup.py') Each element of pathsegments can be either a string representing a path segment, or an object implementing the os.PathLike interface where the __fspath__() method returns a string, such as another path object:\n\n>>> PurePath ( 'foo' , 'some/path' , 'bar' ) PurePosixPath('foo/some/path/bar') >>> PurePath ( Path ( 'foo' ), Path ( 'bar' )) PurePosixPath('foo/bar') When pathsegments is empty, the current directory is assumed:\n\n>>> PurePath () PurePosixPath('.') If a segment is an absolute path, all previous segments are ignored (like os.path.join() ):\n\n```python\n>>> PurePath ( 'setup.py' ) # Running on a Unix machine PurePosixPath('setup.py')\n```\n\n```python\n>>> PurePath ( 'foo' , 'some/path' , 'bar' ) PurePosixPath('foo/some/path/bar') >>> PurePath ( Path ( 'foo' ), Path ( 'bar' )) PurePosixPath('foo/bar')\n```",
    "signature": "class pathlib. PurePath ( * pathsegments )",
    "url": "https://docs.python.org/3.13/library/pathlib.html#pathlib.PurePath"
  },
  "os.path.join": {
    "summary": "Join one or more path segments intelligently. The return value is the concatenation of path and all members of *paths , with exactly one directory separator following each non-empty part, except the last. That is, the result will only end in a separator if the last part is either empty or ends in a separator.",
    "content": "os.path. join ( path , / , * paths )\n\nJoin one or more path segments intelligently. The return value is the concatenation of path and all members of *paths , with exactly one directory separator following each non-empty part, except the last. That is, the result will only end in a separator if the last part is either empty or ends in a separator.\n\nIf a segment is an absolute path (which on Windows requires both a drive and a root), then all previous segments are ignored and joining continues from the absolute path segment. On Linux, for example:\n\n>>> os . path . join ( '/home/foo' , 'bar' ) '/home/foo/bar' >>> os . path . join ( '/home/foo' , '/home/bar' ) '/home/bar' On Windows, the drive is not reset when a rooted path segment (e.g., r'\\foo' ) is encountered. If a segment is on a different drive or is an absolute path, all previous segments are ignored and the drive is reset. For example:\n\n>>> os . path . join ( 'c: \\\\ ' , 'foo' ) 'c:\\\\foo' >>> os . path . join ( 'c: \\\\ foo' , 'd: \\\\ bar' ) 'd:\\\\bar' Note that since there is a current directory for each drive, os.path.join(\"c:\", \"foo\") represents a path relative to the current directory on drive C: ( c:foo ), not c:\\foo .\n\n```python\n>>> os . path . join ( '/home/foo' , 'bar' ) '/home/foo/bar' >>> os . path . join ( '/home/foo' , '/home/bar' ) '/home/bar'\n```\n\n```python\n>>> os . path . join ( 'c: \\\\ ' , 'foo' ) 'c:\\\\foo' >>> os . path . join ( 'c: \\\\ foo' , 'd: \\\\ bar' ) 'd:\\\\bar'\n```",
    "signature": "os.path. join ( path , / , * paths )",
    "url": "https://docs.python.org/3.13/library/os.path.html#os.path.join"
  },
  "os.path.exists": {
    "summary": "Return True if path refers to an existing path or an open file descriptor. Returns False for broken symbolic links. On some platforms, this function may return False if permission is not granted to execute os.stat() on the requested file, even if the path physically exists.",
    "content": "os.path. exists ( path )\n\nReturn True if path refers to an existing path or an open file descriptor. Returns False for broken symbolic links. On some platforms, this function may return False if permission is not granted to execute os.stat() on the requested file, even if the path physically exists.\n\nChanged in version 3.3: path can now be an integer: True is returned if it is an open file descriptor, False otherwise.\n\nChanged in version 3.6: Accepts a path-like object .",
    "signature": "os.path. exists ( path )",
    "url": "https://docs.python.org/3.13/library/os.path.html#os.path.exists"
  },
  "os.path.isfile": {
    "summary": "Return True if path is an existing regular file. This follows symbolic links, so both islink() and isfile() can be true for the same path.",
    "content": "os.path. isfile ( path )\n\nReturn True if path is an existing regular file. This follows symbolic links, so both islink() and isfile() can be true for the same path.\n\nChanged in version 3.6: Accepts a path-like object .",
    "signature": "os.path. isfile ( path )",
    "url": "https://docs.python.org/3.13/library/os.path.html#os.path.isfile"
  },
  "os.path.isdir": {
    "summary": "Return True if path is an existing directory. This follows symbolic links, so both islink() and isdir() can be true for the same path.",
    "content": "os.path. isdir ( path , / )\n\nReturn True if path is an existing directory. This follows symbolic links, so both islink() and isdir() can be true for the same path.\n\nChanged in version 3.6: Accepts a path-like object .",
    "signature": "os.path. isdir ( path , / )",
    "url": "https://docs.python.org/3.13/library/os.path.html#os.path.isdir"
  },
  "os.path.dirname": {
    "summary": "Return the directory name of pathname path . This is the first element of the pair returned by passing path to the function split() .",
    "content": "os.path. dirname ( path , / )\n\nReturn the directory name of pathname path . This is the first element of the pair returned by passing path to the function split() .\n\nChanged in version 3.6: Accepts a path-like object .",
    "signature": "os.path. dirname ( path , / )",
    "url": "https://docs.python.org/3.13/library/os.path.html#os.path.dirname"
  },
  "os.path.basename": {
    "summary": "Return the base name of pathname path . This is the second element of the pair returned by passing path to the function split() . Note that the result of this function is different from the Unix basename program; where basename for '/foo/bar/' returns 'bar' , the basename() function returns an empty string ( '' ).",
    "content": "os.path. basename ( path , / )\n\nReturn the base name of pathname path . This is the second element of the pair returned by passing path to the function split() . Note that the result of this function is different from the Unix basename program; where basename for '/foo/bar/' returns 'bar' , the basename() function returns an empty string ( '' ).\n\nChanged in version 3.6: Accepts a path-like object .",
    "signature": "os.path. basename ( path , / )",
    "url": "https://docs.python.org/3.13/library/os.path.html#os.path.basename"
  },
  "os.path.abspath": {
    "summary": "Return a normalized absolutized version of the pathname path . On most platforms, this is equivalent to calling normpath(join(os.getcwd(), path)) .",
    "content": "os.path. abspath ( path )\n\nReturn a normalized absolutized version of the pathname path . On most platforms, this is equivalent to calling normpath(join(os.getcwd(), path)) .\n\nos.path.join() and os.path.normpath() .\n\nChanged in version 3.6: Accepts a path-like object .",
    "signature": "os.path. abspath ( path )",
    "url": "https://docs.python.org/3.13/library/os.path.html#os.path.abspath"
  },
  "re.compile": {
    "summary": "Compile a regular expression pattern into a regular expression object , which can be used for matching using its match() , search() and other methods, described below.",
    "content": "re. compile ( pattern , flags = 0 )\n\nCompile a regular expression pattern into a regular expression object , which can be used for matching using its match() , search() and other methods, described below.\n\nThe expression’s behaviour can be modified by specifying a flags value. Values can be any of the flags variables, combined using bitwise OR (the | operator).\n\nThe sequence\n\nprog = re . compile ( pattern ) result = prog . match ( string ) is equivalent to\n\n```python\nprog = re . compile ( pattern ) result = prog . match ( string )\n```\n\n```python\nresult = re . match ( pattern , string )\n```",
    "signature": "re. compile ( pattern , flags = 0 )",
    "url": "https://docs.python.org/3.13/library/re.html#re.compile"
  },
  "re.match": {
    "summary": "If zero or more characters at the beginning of string match the regular expression pattern , return a corresponding Match . Return None if the string does not match the pattern; note that this is different from a zero-length match.",
    "content": "re. match ( pattern , string , flags = 0 )\n\nIf zero or more characters at the beginning of string match the regular expression pattern , return a corresponding Match . Return None if the string does not match the pattern; note that this is different from a zero-length match.\n\nNote that even in MULTILINE mode, re.match() will only match at the beginning of the string and not at the beginning of each line.\n\nIf you want to locate a match anywhere in string , use search() instead (see also search() vs. match() ).\n\nThe expression’s behaviour can be modified by specifying a flags value. Values can be any of the flags variables, combined using bitwise OR (the | operator).",
    "signature": "re. match ( pattern , string , flags = 0 )",
    "url": "https://docs.python.org/3.13/library/re.html#re.match"
  },
  "re.search": {
    "summary": "Scan through string looking for the first location where the regular expression pattern produces a match, and return a corresponding Match . Return None if no position in the string matches the pattern; note that this is different from finding a zero-length match at some point in the string.",
    "content": "re. search ( pattern , string , flags = 0 )\n\nScan through string looking for the first location where the regular expression pattern produces a match, and return a corresponding Match . Return None if no position in the string matches the pattern; note that this is different from finding a zero-length match at some point in the string.\n\nThe expression’s behaviour can be modified by specifying a flags value. Values can be any of the flags variables, combined using bitwise OR (the | operator).",
    "signature": "re. search ( pattern , string , flags = 0 )",
    "url": "https://docs.python.org/3.13/library/re.html#re.search"
  },
  "re.findall": {
    "summary": "Return all non-overlapping matches of pattern in string , as a list of strings or tuples. The string is scanned left-to-right, and matches are returned in the order found. Empty matches are included in the result.",
    "content": "re. findall ( pattern , string , flags = 0 )\n\nReturn all non-overlapping matches of pattern in string , as a list of strings or tuples. The string is scanned left-to-right, and matches are returned in the order found. Empty matches are included in the result.\n\nThe result depends on the number of capturing groups in the pattern. If there are no groups, return a list of strings matching the whole pattern. If there is exactly one group, return a list of strings matching that group. If multiple groups are present, return a list of tuples of strings matching the groups. Non-capturing groups do not affect the form of the result.\n\n>>> re . findall ( r '\\bf[a-z]*' , 'which foot or hand fell fastest' ) ['foot', 'fell', 'fastest'] >>> re . findall ( r '(\\w+)=(\\d+)' , 'set width=20 and height=10' ) [('width', '20'), ('height', '10')] The expression’s behaviour can be modified by specifying a flags value. Values can be any of the flags variables, combined using bitwise OR (the | operator).\n\nChanged in version 3.7: Non-empty matches can now start just after a previous empty match.\n\n```python\n>>> re . findall ( r '\\bf[a-z]*' , 'which foot or hand fell fastest' ) ['foot', 'fell', 'fastest'] >>> re . findall ( r '(\\w+)=(\\d+)' , 'set width=20 and height=10' ) [('width', '20'), ('height', '10')]\n```",
    "signature": "re. findall ( pattern , string , flags = 0 )",
    "url": "https://docs.python.org/3.13/library/re.html#re.findall"
  },
  "re.sub": {
    "summary": "Return the string obtained by replacing the leftmost non-overlapping occurrences of pattern in string by the replacement repl . If the pattern isn’t found, string is returned unchanged. repl can be a string or a function; if it is a string, any backslash escapes in it are processed. That is, \\n is converted to a single newline character, \\r is converted to a carriage return, and so forth. Unknown escapes of ASCII letters are reserved for future use and treated as errors. Other unknown escapes such as \\& are left alone. Backreferences, such as \\6 , are replaced with the substring matched by group 6 in the pattern. For example:",
    "content": "re. sub ( pattern , repl , string , count = 0 , flags = 0 )\n\nReturn the string obtained by replacing the leftmost non-overlapping occurrences of pattern in string by the replacement repl . If the pattern isn’t found, string is returned unchanged. repl can be a string or a function; if it is a string, any backslash escapes in it are processed. That is, \\n is converted to a single newline character, \\r is converted to a carriage return, and so forth. Unknown escapes of ASCII letters are reserved for future use and treated as errors. Other unknown escapes such as \\& are left alone. Backreferences, such as \\6 , are replaced with the substring matched by group 6 in the pattern. For example:\n\n>>> re . sub ( r 'def\\s+([a-zA-Z_][a-zA-Z_0-9]*)\\s*\\(\\s*\\):' , ... r 'static PyObject*\\npy_\\1(void)\\n{' , ... 'def myfunc():' ) 'static PyObject*\\npy_myfunc(void)\\n{' If repl is a function, it is called for every non-overlapping occurrence of pattern . The function takes a single Match argument, and returns the replacement string. For example:\n\n>>> def dashrepl ( matchobj ): ... if matchobj . group ( 0 ) == '-' : return ' ' ... else : return '-' ... >>> re . sub ( '-{1,2}' , dashrepl , 'pro----gram-files' ) 'pro--gram files' >>> re . sub ( r '\\sAND\\s' , ' & ' , 'Baked Beans And Spam' , flags = re . IGNORECASE ) 'Baked Beans & Spam' The pattern may be a string or a Pattern .\n\nThe optional argument count is the maximum number of pattern occurrences to be replaced; count must be a non-negative in…",
    "signature": "re. sub ( pattern , repl , string , count = 0 , flags = 0 )",
    "url": "https://docs.python.org/3.13/library/re.html#re.sub"
  },
  "re.split": {
    "summary": "Split string by the occurrences of pattern . If capturing parentheses are used in pattern , then the text of all groups in the pattern are also returned as part of the resulting list. If maxsplit is nonzero, at most maxsplit splits occur, and the remainder of the string is returned as the final element of the list.",
    "content": "re. split ( pattern , string , maxsplit = 0 , flags = 0 )\n\nSplit string by the occurrences of pattern . If capturing parentheses are used in pattern , then the text of all groups in the pattern are also returned as part of the resulting list. If maxsplit is nonzero, at most maxsplit splits occur, and the remainder of the string is returned as the final element of the list.\n\n>>> re . split ( r '\\W+' , 'Words, words, words.' ) ['Words', 'words', 'words', ''] >>> re . split ( r '(\\W+)' , 'Words, words, words.' ) ['Words', ', ', 'words', ', ', 'words', '.', ''] >>> re . split ( r '\\W+' , 'Words, words, words.' , maxsplit = 1 ) ['Words', 'words, words.'] >>> re . split ( '[a-f]+' , '0a3B9' , flags = re . IGNORECASE ) ['0', '3', '9'] If there are capturing groups in the separator and it matches at the start of the string, the result will start with an empty string. The same holds for the end of the string:\n\n>>> re . split ( r '(\\W+)' , '...words, words...' ) ['', '...', 'words', ', ', 'words', '...', ''] That way, separator components are always found at the same relative indices within the result list.\n\nAdjacent empty matches are not possible, but an empty match can occur immediately after a non-empty match.\n\n```python\n>>> re . split ( r '\\W+' , 'Words, words, words.' ) ['Words', 'words', 'words', ''] >>> re . split ( r '(\\W+)' , 'Words, words, words.' ) ['Words', ', ', 'words', ', ', 'words', '.', ''] >>> re . split ( r '\\W+' , 'Words, words, words.' , maxsplit = 1 ) ['Words', 'w…",
    "signature": "re. split ( pattern , string , maxsplit = 0 , flags = 0 )",
    "url": "https://docs.python.org/3.13/library/re.html#re.split"
  },
  "re.Pattern": {
    "summary": "Compiled regular expression object returned by re.compile() .",
    "content": "class re. Pattern\n\nCompiled regular expression object returned by re.compile() .\n\nChanged in version 3.9: re.Pattern supports [] to indicate a Unicode (str) or bytes pattern. See Generic Alias Type .",
    "signature": "class re. Pattern",
    "url": "https://docs.python.org/3.13/library/re.html#re.Pattern"
  },
  "re.Match": {
    "summary": "If zero or more characters at the beginning of string match the regular expression pattern , return a corresponding Match . Return None if the string does not match the pattern; note that this is different from a zero-length match.",
    "content": "re. match ( pattern , string , flags = 0 )\n\nIf zero or more characters at the beginning of string match the regular expression pattern , return a corresponding Match . Return None if the string does not match the pattern; note that this is different from a zero-length match.\n\nNote that even in MULTILINE mode, re.match() will only match at the beginning of the string and not at the beginning of each line.\n\nIf you want to locate a match anywhere in string , use search() instead (see also search() vs. match() ).\n\nThe expression’s behaviour can be modified by specifying a flags value. Values can be any of the flags variables, combined using bitwise OR (the | operator).",
    "signature": "re. match ( pattern , string , flags = 0 )",
    "url": "https://docs.python.org/3.13/library/re.html#re.Match"
  },
  "json.dumps": {
    "summary": "Serialize obj to a JSON formatted str using this conversion table . The arguments have the same meaning as in dump() .",
    "content": "json. dumps ( obj , * , skipkeys = False , ensure_ascii = True , check_circular = True , allow_nan = True , cls = None , indent = None , separators = None , default = None , sort_keys = False , ** kw )\n\nSerialize obj to a JSON formatted str using this conversion table . The arguments have the same meaning as in dump() .\n\nKeys in key/value pairs of JSON are always of the type str . When a dictionary is converted into JSON, all the keys of the dictionary are coerced to strings. As a result of this, if a dictionary is converted into JSON and then back into a dictionary, the dictionary may not equal the original one. That is, loads(dumps(x)) != x if x has non-string keys.",
    "signature": "json. dumps ( obj , * , skipkeys = False , ensure_ascii = True , check_circular = True , allow_nan = True , cls = None , indent = None , separators = None , default = None , sort_keys = False , ** kw )",
    "url": "https://docs.python.org/3.13/library/json.html#json.dumps"
  },
  "json.loads": {
    "summary": "Identical to load() , but instead of a file-like object, deserialize s (a str , bytes or bytearray instance containing a JSON document) to a Python object using this conversion table .",
    "content": "json. loads ( s , * , cls = None , object_hook = None , parse_float = None , parse_int = None , parse_constant = None , object_pairs_hook = None , ** kw )\n\nIdentical to load() , but instead of a file-like object, deserialize s (a str , bytes or bytearray instance containing a JSON document) to a Python object using this conversion table .\n\nChanged in version 3.6: s can now be of type bytes or bytearray . The input encoding should be UTF-8, UTF-16 or UTF-32.\n\nChanged in version 3.9: The keyword argument encoding has been removed.",
    "signature": "json. loads ( s , * , cls = None , object_hook = None , parse_float = None , parse_int = None , parse_constant = None , object_pairs_hook = None , ** kw )",
    "url": "https://docs.python.org/3.13/library/json.html#json.loads"
  },
  "json.dump": {
    "summary": "Serialize obj as a JSON formatted stream to fp (a .write() -supporting file-like object ) using this Python-to-JSON conversion table .",
    "content": "json. dump ( obj , fp , * , skipkeys = False , ensure_ascii = True , check_circular = True , allow_nan = True , cls = None , indent = None , separators = None , default = None , sort_keys = False , ** kw )\n\nSerialize obj as a JSON formatted stream to fp (a .write() -supporting file-like object ) using this Python-to-JSON conversion table .\n\nUnlike pickle and marshal , JSON is not a framed protocol, so trying to serialize multiple objects with repeated calls to dump() using the same fp will result in an invalid JSON file.\n\nobj ( object ) – The Python object to be serialized.",
    "signature": "json. dump ( obj , fp , * , skipkeys = False , ensure_ascii = True , check_circular = True , allow_nan = True , cls = None , indent = None , separators = None , default = None , sort_keys = False , ** kw )",
    "url": "https://docs.python.org/3.13/library/json.html#json.dump"
  },
  "json.load": {
    "summary": "Deserialize fp to a Python object using the JSON-to-Python conversion table .",
    "content": "json. load ( fp , * , cls = None , object_hook = None , parse_float = None , parse_int = None , parse_constant = None , object_pairs_hook = None , ** kw )\n\nDeserialize fp to a Python object using the JSON-to-Python conversion table .\n\nfp ( file-like object ) – A .read() -supporting text file or binary file containing the JSON document to be deserialized.\n\ncls (a JSONDecoder subclass) – If set, a custom JSON decoder. Additional keyword arguments to load() will be passed to the constructor of cls . If None (the default), JSONDecoder is used.\n\nobject_hook ( callable | None) – If set, a function that is called with the result of any JSON object literal decoded (a dict ). The return value of this function will be used instead of the dict . This feature can be used to implement custom decoders, for example JSON-RPC class hinting. Default None .",
    "signature": "json. load ( fp , * , cls = None , object_hook = None , parse_float = None , parse_int = None , parse_constant = None , object_pairs_hook = None , ** kw )",
    "url": "https://docs.python.org/3.13/library/json.html#json.load"
  },
  "json.JSONEncoder": {
    "summary": "Extensible JSON encoder for Python data structures.",
    "content": "class json. JSONEncoder ( * , skipkeys = False , ensure_ascii = True , check_circular = True , allow_nan = True , sort_keys = False , indent = None , separators = None , default = None )\n\nExtensible JSON encoder for Python data structures.\n\nSupports the following objects and types by default:\n\n```python\ndef default ( self , o ): try : iterable = iter ( o ) except TypeError : pass else : return list ( iterable ) # Let the base class default method raise the TypeError return super () . default ( o )\n```",
    "signature": "class json. JSONEncoder ( * , skipkeys = False , ensure_ascii = True , check_circular = True , allow_nan = True , sort_keys = False , indent = None , separators = None , default = None )",
    "url": "https://docs.python.org/3.13/library/json.html#json.JSONEncoder"
  },
  "json.JSONDecoder": {
    "summary": "Simple JSON decoder.",
    "content": "class json. JSONDecoder ( * , object_hook = None , parse_float = None , parse_int = None , parse_constant = None , strict = True , object_pairs_hook = None )\n\nSimple JSON decoder.\n\nPerforms the following translations in decoding by default:",
    "signature": "class json. JSONDecoder ( * , object_hook = None , parse_float = None , parse_int = None , parse_constant = None , strict = True , object_pairs_hook = None )",
    "url": "https://docs.python.org/3.13/library/json.html#json.JSONDecoder"
  },
  "os.listdir": {
    "summary": "Return a list containing the names of the entries in the directory given by path . The list is in arbitrary order, and does not include the special entries '.' and '..' even if they are present in the directory. If a file is removed from or added to the directory during the call of this function, whether a name for that file be included is unspecified.",
    "content": "os. listdir ( path = '.' )\n\nReturn a list containing the names of the entries in the directory given by path . The list is in arbitrary order, and does not include the special entries '.' and '..' even if they are present in the directory. If a file is removed from or added to the directory during the call of this function, whether a name for that file be included is unspecified.\n\npath may be a path-like object . If path is of type bytes (directly or indirectly through the PathLike interface), the filenames returned will also be of type bytes ; in all other circumstances, they will be of type str .\n\nThis function can also support specifying a file descriptor ; the file descriptor must refer to a directory.\n\nRaises an auditing event os.listdir with argument path .",
    "signature": "os. listdir ( path = '.' )",
    "url": "https://docs.python.org/3.13/library/os.html#os.listdir"
  },
  "os.makedirs": {
    "summary": "Recursive directory creation function. Like mkdir() , but makes all intermediate-level directories needed to contain the leaf directory.",
    "content": "os. makedirs ( name , mode = 0o777 , exist_ok = False )\n\nRecursive directory creation function. Like mkdir() , but makes all intermediate-level directories needed to contain the leaf directory.\n\nThe mode parameter is passed to mkdir() for creating the leaf directory; see the mkdir() description for how it is interpreted. To set the file permission bits of any newly created parent directories you can set the umask before invoking makedirs() . The file permission bits of existing parent directories are not changed.\n\nIf exist_ok is False (the default), a FileExistsError is raised if the target directory already exists.",
    "signature": "os. makedirs ( name , mode = 0o777 , exist_ok = False )",
    "url": "https://docs.python.org/3.13/library/os.html#os.makedirs"
  },
  "os.environ": {
    "summary": "A mapping object where keys and values are strings that represent the process environment. For example, environ['HOME'] is the pathname of your home directory (on some platforms), and is equivalent to getenv(\"HOME\") in C.",
    "content": "os. environ\n\nA mapping object where keys and values are strings that represent the process environment. For example, environ['HOME'] is the pathname of your home directory (on some platforms), and is equivalent to getenv(\"HOME\") in C.\n\nThis mapping is captured the first time the os module is imported, typically during Python startup as part of processing site.py . Changes to the environment made after this time are not reflected in os.environ , except for changes made by modifying os.environ directly.\n\nThis mapping may be used to modify the environment as well as query the environment. putenv() will be called automatically when the mapping is modified.\n\nOn Unix, keys and values use sys.getfilesystemencoding() and 'surrogateescape' error handler. Use environb if you would like to use a different encoding.",
    "signature": "os. environ",
    "url": "https://docs.python.org/3.13/library/os.html#os.environ"
  },
  "os.getenv": {
    "summary": "Return the value of the environment variable key as a string if it exists, or default if it doesn’t. key is a string. Note that since getenv() uses os.environ , the mapping of getenv() is similarly also captured on import, and the function may not reflect future environment changes.",
    "content": "os. getenv ( key , default = None )\n\nReturn the value of the environment variable key as a string if it exists, or default if it doesn’t. key is a string. Note that since getenv() uses os.environ , the mapping of getenv() is similarly also captured on import, and the function may not reflect future environment changes.\n\nOn Unix, keys and values are decoded with sys.getfilesystemencoding() and 'surrogateescape' error handler. Use os.getenvb() if you would like to use a different encoding.\n\nAvailability : Unix, Windows.",
    "signature": "os. getenv ( key , default = None )",
    "url": "https://docs.python.org/3.13/library/os.html#os.getenv"
  },
  "abc.ABC": {
    "summary": "A helper class that has ABCMeta as its metaclass. With this class, an abstract base class can be created by simply deriving from ABC avoiding sometimes confusing metaclass usage, for example:",
    "content": "class abc. ABC\n\nA helper class that has ABCMeta as its metaclass. With this class, an abstract base class can be created by simply deriving from ABC avoiding sometimes confusing metaclass usage, for example:\n\nfrom abc import ABC class MyABC ( ABC ): pass Note that the type of ABC is still ABCMeta , therefore inheriting from ABC requires the usual precautions regarding metaclass usage, as multiple inheritance may lead to metaclass conflicts. One may also define an abstract base class by passing the metaclass keyword and using ABCMeta directly, for example:\n\nfrom abc import ABCMeta class MyABC ( metaclass = ABCMeta ): pass Added in version 3.4.\n\n```python\nfrom abc import ABC class MyABC ( ABC ): pass\n```\n\n```python\nfrom abc import ABCMeta class MyABC ( metaclass = ABCMeta ): pass\n```",
    "signature": "class abc. ABC",
    "url": "https://docs.python.org/3.13/library/abc.html#abc.ABC"
  },
  "abc.ABCMeta": {
    "summary": "Metaclass for defining Abstract Base Classes (ABCs).",
    "content": "class abc. ABCMeta\n\nMetaclass for defining Abstract Base Classes (ABCs).\n\nUse this metaclass to create an ABC. An ABC can be subclassed directly, and then acts as a mix-in class. You can also register unrelated concrete classes (even built-in classes) and unrelated ABCs as “virtual subclasses” – these and their descendants will be considered subclasses of the registering ABC by the built-in issubclass() function, but the registering ABC won’t show up in their MRO (Method Resolution Order) nor will method implementations defined by the registering ABC be callable (not even via super() ). [ 1 ]\n\nClasses created with a metaclass of ABCMeta have the following method:\n\nRegister subclass as a “virtual subclass” of this ABC. For example:\n\n```python\nfrom abc import ABC class MyABC ( ABC ): pass MyABC . register ( tuple ) assert issubclass ( tuple , MyABC ) assert isinstance ((), MyABC )\n```",
    "signature": "class abc. ABCMeta",
    "url": "https://docs.python.org/3.13/library/abc.html#abc.ABCMeta"
  },
  "abc.abstractmethod": {
    "summary": "A decorator indicating abstract methods.",
    "content": "@ abc. abstractmethod\n\nA decorator indicating abstract methods.\n\nUsing this decorator requires that the class’s metaclass is ABCMeta or is derived from it. A class that has a metaclass derived from ABCMeta cannot be instantiated unless all of its abstract methods and properties are overridden. The abstract methods can be called using any of the normal ‘super’ call mechanisms. abstractmethod() may be used to declare abstract methods for properties and descriptors.\n\nDynamically adding abstract methods to a class, or attempting to modify the abstraction status of a method or class once it is created, are only supported using the update_abstractmethods() function. The abstractmethod() only affects subclasses derived using regular inheritance; “virtual subclasses” registered with the ABC’s register() method are not affected.\n\nWhen abstractmethod() is applied in combination with other method descriptors, it should be applied as the innermost decorator, as shown in the following usage examples:\n\n```python\nclass Descriptor : ... @property def __isabstractmethod__ ( self ): return any ( getattr ( f , '__isabstractmethod__' , False ) for f in ( self . _fget , self . _fset , self . _fdel ))\n```",
    "signature": "@ abc. abstractmethod",
    "url": "https://docs.python.org/3.13/library/abc.html#abc.abstractmethod"
  },
  "datetime.datetime": {
    "summary": "The year , month and day arguments are required. tzinfo may be None , or an instance of a tzinfo subclass. The remaining arguments must be integers in the following ranges:",
    "content": "class datetime. datetime ( year , month , day , hour = 0 , minute = 0 , second = 0 , microsecond = 0 , tzinfo = None , * , fold = 0 )\n\nThe year , month and day arguments are required. tzinfo may be None , or an instance of a tzinfo subclass. The remaining arguments must be integers in the following ranges:\n\nMINYEAR <= year <= MAXYEAR ,\n\n1 <= month <= 12 ,\n\n1 <= day <= number of days in the given month and year ,",
    "signature": "class datetime. datetime ( year , month , day , hour = 0 , minute = 0 , second = 0 , microsecond = 0 , tzinfo = None , * , fold = 0 )",
    "url": "https://docs.python.org/3.13/library/datetime.html#datetime.datetime"
  },
  "datetime.date": {
    "summary": "All arguments are required. Arguments must be integers, in the following ranges:",
    "content": "class datetime. date ( year , month , day )\n\nAll arguments are required. Arguments must be integers, in the following ranges:\n\nMINYEAR <= year <= MAXYEAR\n\n1 <= month <= 12\n\n1 <= day <= number of days in the given month and year",
    "signature": "class datetime. date ( year , month , day )",
    "url": "https://docs.python.org/3.13/library/datetime.html#datetime.date"
  },
  "datetime.time": {
    "summary": "All arguments are optional. tzinfo may be None , or an instance of a tzinfo subclass. The remaining arguments must be integers in the following ranges:",
    "content": "class datetime. time ( hour = 0 , minute = 0 , second = 0 , microsecond = 0 , tzinfo = None , * , fold = 0 )\n\nAll arguments are optional. tzinfo may be None , or an instance of a tzinfo subclass. The remaining arguments must be integers in the following ranges:\n\n0 <= hour < 24 ,\n\n0 <= minute < 60 ,\n\n0 <= second < 60 ,",
    "signature": "class datetime. time ( hour = 0 , minute = 0 , second = 0 , microsecond = 0 , tzinfo = None , * , fold = 0 )",
    "url": "https://docs.python.org/3.13/library/datetime.html#datetime.time"
  },
  "datetime.timedelta": {
    "summary": "All arguments are optional and default to 0. Arguments may be integers or floats, and may be positive or negative.",
    "content": "class datetime. timedelta ( days = 0 , seconds = 0 , microseconds = 0 , milliseconds = 0 , minutes = 0 , hours = 0 , weeks = 0 )\n\nAll arguments are optional and default to 0. Arguments may be integers or floats, and may be positive or negative.\n\nOnly days , seconds and microseconds are stored internally. Arguments are converted to those units:\n\nA millisecond is converted to 1000 microseconds.\n\nA minute is converted to 60 seconds.\n\n```python\n>>> import datetime as dt >>> delta = dt . timedelta ( ... days = 50 , ... seconds = 27 , ... microseconds = 10 , ... milliseconds = 29000 , ... minutes = 5 , ... hours = 8 , ... weeks = 2 ... ) >>> # Only days, seconds, and microseconds remain >>> delta datetime.timedelta(days=64, seconds=29156, microseconds=10)\n```\n\n```python\n>>> import datetime as dt >>> d = dt . timedelta ( microseconds =- 1 ) >>> ( d . days , d . seconds , d . microseconds ) (-1, 86399, 999999)\n```",
    "signature": "class datetime. timedelta ( days = 0 , seconds = 0 , microseconds = 0 , milliseconds = 0 , minutes = 0 , hours = 0 , weeks = 0 )",
    "url": "https://docs.python.org/3.13/library/datetime.html#datetime.timedelta"
  },
  "logging.getLogger": {
    "summary": "Return a logger with the specified name or, if name is None , return the root logger of the hierarchy. If specified, the name is typically a dot-separated hierarchical name like ‘a’ , ‘a.b’ or ‘a.b.c.d’ . Choice of these names is entirely up to the developer who is using logging, though it is recommended that __name__ be used unless you have a specific reason for not doing that, as mentioned in Logger Objects .",
    "content": "logging. getLogger ( name = None )\n\nReturn a logger with the specified name or, if name is None , return the root logger of the hierarchy. If specified, the name is typically a dot-separated hierarchical name like ‘a’ , ‘a.b’ or ‘a.b.c.d’ . Choice of these names is entirely up to the developer who is using logging, though it is recommended that __name__ be used unless you have a specific reason for not doing that, as mentioned in Logger Objects .\n\nAll calls to this function with a given name return the same logger instance. This means that logger instances never need to be passed between different parts of an application.",
    "signature": "logging. getLogger ( name = None )",
    "url": "https://docs.python.org/3.13/library/logging.html#logging.getLogger"
  },
  "logging.Logger": {
    "summary": "This is the logger’s name, and is the value that was passed to getLogger() to obtain the logger.",
    "content": "class logging. Logger\n\nThis is the logger’s name, and is the value that was passed to getLogger() to obtain the logger.\n\nThis attribute should be treated as read-only.",
    "signature": "class logging. Logger",
    "url": "https://docs.python.org/3.13/library/logging.html#logging.Logger"
  },
  "logging.Handler": {
    "summary": "Initializes the Handler instance by setting its level, setting the list of filters to the empty list and creating a lock (using createLock() ) for serializing access to an I/O mechanism.",
    "content": "class logging. Handler\n\nInitializes the Handler instance by setting its level, setting the list of filters to the empty list and creating a lock (using createLock() ) for serializing access to an I/O mechanism.",
    "signature": "class logging. Handler",
    "url": "https://docs.python.org/3.13/library/logging.html#logging.Handler"
  },
  "typing.Any": {
    "summary": "Special type indicating an unconstrained type.",
    "content": "typing. Any\n\nSpecial type indicating an unconstrained type.\n\nEvery type is compatible with Any .\n\nAny is compatible with every type.\n\nChanged in version 3.11: Any can now be used as a base class. This can be useful for avoiding type checker errors with classes that can duck type anywhere or are highly dynamic.",
    "signature": "typing. Any",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Any"
  },
  "typing.Union": {
    "summary": "Union type; Union[X, Y] is equivalent to X | Y and means either X or Y.",
    "content": "typing. Union\n\nUnion type; Union[X, Y] is equivalent to X | Y and means either X or Y.\n\nTo define a union, use e.g. Union[int, str] or the shorthand int | str . Using that shorthand is recommended. Details:\n\nThe arguments must be types and there must be at least one.\n\nUnions of unions are flattened, e.g.:\n\n```python\nUnion [ Union [ int , str ], float ] == Union [ int , str , float ]\n```\n\n```python\ntype A = Union [ int , str ] Union [ A , float ] != Union [ int , str , float ]\n```",
    "signature": "typing. Union",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Union"
  },
  "typing.Optional": {
    "summary": "Optional[X] is equivalent to X | None (or Union[X, None] ).",
    "content": "typing. Optional\n\nOptional[X] is equivalent to X | None (or Union[X, None] ).\n\nNote that this is not the same concept as an optional argument, which is one that has a default. An optional argument with a default does not require the Optional qualifier on its type annotation just because it is optional. For example:\n\ndef foo ( arg : int = 0 ) -> None : ... On the other hand, if an explicit value of None is allowed, the use of Optional is appropriate, whether the argument is optional or not. For example:\n\ndef foo ( arg : Optional [ int ] = None ) -> None : ... Changed in version 3.10: Optional can now be written as X | None . See union type expressions .\n\n```python\ndef foo ( arg : int = 0 ) -> None : ...\n```\n\n```python\ndef foo ( arg : Optional [ int ] = None ) -> None : ...\n```",
    "signature": "typing. Optional",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Optional"
  },
  "typing.List": {
    "summary": "Deprecated alias to list .",
    "content": "class typing. List ( list, MutableSequence[T] )\n\nDeprecated alias to list .\n\nNote that to annotate arguments, it is preferred to use an abstract collection type such as Sequence or Iterable rather than to use list or typing.List .\n\nDeprecated since version 3.9: builtins.list now supports subscripting ( [] ). See PEP 585 and Generic Alias Type .",
    "signature": "class typing. List ( list, MutableSequence[T] )",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.List"
  },
  "typing.Dict": {
    "summary": "Deprecated alias to dict .",
    "content": "class typing. Dict ( dict, MutableMapping[KT, VT] )\n\nDeprecated alias to dict .\n\nNote that to annotate arguments, it is preferred to use an abstract collection type such as Mapping rather than to use dict or typing.Dict .\n\nDeprecated since version 3.9: builtins.dict now supports subscripting ( [] ). See PEP 585 and Generic Alias Type .",
    "signature": "class typing. Dict ( dict, MutableMapping[KT, VT] )",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Dict"
  },
  "typing.Tuple": {
    "summary": "Deprecated alias for tuple .",
    "content": "typing. Tuple\n\nDeprecated alias for tuple .\n\ntuple and Tuple are special-cased in the type system; see Annotating tuples for more details.\n\nDeprecated since version 3.9: builtins.tuple now supports subscripting ( [] ). See PEP 585 and Generic Alias Type .",
    "signature": "typing. Tuple",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Tuple"
  },
  "typing.Set": {
    "summary": "Deprecated alias to builtins.set .",
    "content": "class typing. Set ( set, MutableSet[T] )\n\nDeprecated alias to builtins.set .\n\nNote that to annotate arguments, it is preferred to use an abstract collection type such as collections.abc.Set rather than to use set or typing.Set .\n\nDeprecated since version 3.9: builtins.set now supports subscripting ( [] ). See PEP 585 and Generic Alias Type .",
    "signature": "class typing. Set ( set, MutableSet[T] )",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Set"
  },
  "typing.Literal": {
    "summary": "Special typing form to define “literal types”.",
    "content": "typing. Literal\n\nSpecial typing form to define “literal types”.\n\nLiteral can be used to indicate to type checkers that the annotated object has a value equivalent to one of the provided literals.\n\nFor example:\n\ndef validate_simple ( data : Any ) -> Literal [ True ]: # always returns True ... type Mode = Literal [ 'r' , 'rb' , 'w' , 'wb' ] def open_helper ( file : str , mode : Mode ) -> str : ... open_helper ( '/some/path' , 'r' ) # Passes type check open_helper ( '/other/path' , 'typo' ) # Error in type checker Literal[...] cannot be subclassed. At runtime, an arbitrary value is allowed as type argument to Literal[...] , but type checkers may impose restrictions. See PEP 586 for more details about literal types.\n\n```python\ndef validate_simple ( data : Any ) -> Literal [ True ]: # always returns True ... type Mode = Literal [ 'r' , 'rb' , 'w' , 'wb' ] def open_helper ( file : str , mode : Mode ) -> str : ... open_helper ( '/some/path' , 'r' ) # Passes type check open_helper ( '/other/path' , 'typo' ) # Error in type checker\n```\n\n```python\nassert Literal [ Literal [ 1 , 2 ], 3 ] == Literal [ 1 , 2 , 3 ]\n```",
    "signature": "typing. Literal",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Literal"
  },
  "typing.TypeVar": {
    "summary": "Type variable.",
    "content": "class typing. TypeVar ( name , * constraints , bound = None , covariant = False , contravariant = False , infer_variance = False , default = typing.NoDefault )\n\nType variable.\n\nThe preferred way to construct a type variable is via the dedicated syntax for generic functions , generic classes , and generic type aliases :\n\nclass Sequence [ T ]: # T is a TypeVar ... This syntax can also be used to create bounded and constrained type variables:\n\nclass StrSequence [ S : str ]: # S is a TypeVar with a `str` upper bound; ... # we can say that S is \"bounded by `str`\" class StrOrBytesSequence [ A : ( str , bytes )]: # A is a TypeVar constrained to str or bytes ... However, if desired, reusable type variables can also be constructed manually, like so:\n\n```python\nclass Sequence [ T ]: # T is a TypeVar ...\n```\n\n```python\nclass StrSequence [ S : str ]: # S is a TypeVar with a `str` upper bound; ... # we can say that S is \"bounded by `str`\" class StrOrBytesSequence [ A : ( str , bytes )]: # A is a TypeVar constrained to str or bytes ...\n```",
    "signature": "class typing. TypeVar ( name , * constraints , bound = None , covariant = False , contravariant = False , infer_variance = False , default = typing.NoDefault )",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.TypeVar"
  },
  "typing.Generic": {
    "summary": "Abstract base class for generic types.",
    "content": "class typing. Generic\n\nAbstract base class for generic types.\n\nA generic type is typically declared by adding a list of type parameters after the class name:\n\nclass Mapping [ KT , VT ]: def __getitem__ ( self , key : KT ) -> VT : ... # Etc. Such a class implicitly inherits from Generic . The runtime semantics of this syntax are discussed in the Language Reference .\n\nThis class can then be used as follows:\n\n```python\nclass Mapping [ KT , VT ]: def __getitem__ ( self , key : KT ) -> VT : ... # Etc.\n```\n\n```python\ndef lookup_name [ X , Y ]( mapping : Mapping [ X , Y ], key : X , default : Y ) -> Y : try : return mapping [ key ] except KeyError : return default\n```",
    "signature": "class typing. Generic",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Generic"
  },
  "typing.Protocol": {
    "summary": "Base class for protocol classes.",
    "content": "class typing. Protocol ( Generic )\n\nBase class for protocol classes.\n\nProtocol classes are defined like this:\n\nclass Proto ( Protocol ): def meth ( self ) -> int : ... Such classes are primarily used with static type checkers that recognize structural subtyping (static duck-typing), for example:\n\nclass C : def meth ( self ) -> int : return 0 def func ( x : Proto ) -> int : return x . meth () func ( C ()) # Passes static type check See PEP 544 for more details. Protocol classes decorated with runtime_checkable() (described later) act as simple-minded runtime protocols that check only the presence of given attributes, ignoring their type signatures. Protocol classes without this decorator cannot be used as the second argument to isinstance() or issubclass() .\n\n```python\nclass Proto ( Protocol ): def meth ( self ) -> int : ...\n```\n\n```python\nclass C : def meth ( self ) -> int : return 0 def func ( x : Proto ) -> int : return x . meth () func ( C ()) # Passes static type check\n```",
    "signature": "class typing. Protocol ( Generic )",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Protocol"
  },
  "typing.TypedDict": {
    "summary": "Special construct to add type hints to a dictionary. At runtime “ TypedDict instances” are simply dicts .",
    "content": "class typing. TypedDict ( dict )\n\nSpecial construct to add type hints to a dictionary. At runtime “ TypedDict instances” are simply dicts .\n\nTypedDict declares a dictionary type that expects all of its instances to have a certain set of keys, where each key is associated with a value of a consistent type. This expectation is not checked at runtime but is only enforced by type checkers. Usage:\n\nclass Point2D ( TypedDict ): x : int y : int label : str a : Point2D = { 'x' : 1 , 'y' : 2 , 'label' : 'good' } # OK b : Point2D = { 'z' : 3 , 'label' : 'bad' } # Fails type check assert Point2D ( x = 1 , y = 2 , label = 'first' ) == dict ( x = 1 , y = 2 , label = 'first' ) An alternative way to create a TypedDict is by using function-call syntax. The second argument must be a literal dict :\n\nPoint2D = TypedDict ( 'Point2D' , { 'x' : int , 'y' : int , 'label' : str }) This functional syntax allows defining keys which are not valid identifiers , for example because they are keywords or contain hyphens, or when key names must not be mangled like regular private names:\n\n```python\nclass Point2D ( TypedDict ): x : int y : int label : str a : Point2D = { 'x' : 1 , 'y' : 2 , 'label' : 'good' } # OK b : Point2D = { 'z' : 3 , 'label' : 'bad' } # Fails type check assert Point2D ( x = 1 , y = 2 , label = 'first' ) == dict ( x = 1 , y = 2 , label = 'first' )\n```\n\n```python\nPoint2D = TypedDict ( 'Point2D' , { 'x' : int , 'y' : int , 'label' : str })\n```",
    "signature": "class typing. TypedDict ( dict )",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.TypedDict"
  },
  "typing.Final": {
    "summary": "Special typing construct to indicate final names to type checkers.",
    "content": "typing. Final\n\nSpecial typing construct to indicate final names to type checkers.\n\nFinal names cannot be reassigned in any scope. Final names declared in class scopes cannot be overridden in subclasses.\n\nFor example:\n\nMAX_SIZE : Final = 9000 MAX_SIZE += 1 # Error reported by type checker class Connection : TIMEOUT : Final [ int ] = 10 class FastConnector ( Connection ): TIMEOUT = 1 # Error reported by type checker There is no runtime checking of these properties. See PEP 591 for more details.\n\n```python\nMAX_SIZE : Final = 9000 MAX_SIZE += 1 # Error reported by type checker class Connection : TIMEOUT : Final [ int ] = 10 class FastConnector ( Connection ): TIMEOUT = 1 # Error reported by type checker\n```",
    "signature": "typing. Final",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Final"
  },
  "typing.ClassVar": {
    "summary": "Special type construct to mark class variables.",
    "content": "typing. ClassVar\n\nSpecial type construct to mark class variables.\n\nAs introduced in PEP 526 , a variable annotation wrapped in ClassVar indicates that a given attribute is intended to be used as a class variable and should not be set on instances of that class. Usage:\n\nclass Starship : stats : ClassVar [ dict [ str , int ]] = {} # class variable damage : int = 10 # instance variable ClassVar accepts only types and cannot be further subscribed.\n\nClassVar is not a class itself, and should not be used with isinstance() or issubclass() . ClassVar does not change Python runtime behavior, but it can be used by third-party type checkers. For example, a type checker might flag the following code as an error:\n\n```python\nclass Starship : stats : ClassVar [ dict [ str , int ]] = {} # class variable damage : int = 10 # instance variable\n```\n\n```python\nenterprise_d = Starship ( 3000 ) enterprise_d . stats = {} # Error, setting class variable on instance Starship . stats = {} # This is OK\n```",
    "signature": "typing. ClassVar",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.ClassVar"
  },
  "typing.Callable": {
    "summary": "Deprecated alias to collections.abc.Callable .",
    "content": "typing. Callable\n\nDeprecated alias to collections.abc.Callable .\n\nSee Annotating callable objects for details on how to use collections.abc.Callable and typing.Callable in type annotations.\n\nDeprecated since version 3.9: collections.abc.Callable now supports subscripting ( [] ). See PEP 585 and Generic Alias Type .\n\nChanged in version 3.10: Callable now supports ParamSpec and Concatenate . See PEP 612 for more details.",
    "signature": "typing. Callable",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.Callable"
  },
  "typing.overload": {
    "summary": "Decorator for creating overloaded functions and methods.",
    "content": "@ typing. overload\n\nDecorator for creating overloaded functions and methods.\n\nThe @overload decorator allows describing functions and methods that support multiple different combinations of argument types. A series of @overload -decorated definitions must be followed by exactly one non- @overload -decorated definition (for the same function/method).\n\n@overload -decorated definitions are for the benefit of the type checker only, since they will be overwritten by the non- @overload -decorated definition. The non- @overload -decorated definition, meanwhile, will be used at runtime but should be ignored by a type checker. At runtime, calling an @overload -decorated function directly will raise NotImplementedError .\n\nAn example of overload that gives a more precise type than can be expressed using a union or a type variable:\n\n```python\n@overload def process ( response : None ) -> None : ... @overload def process ( response : int ) -> tuple [ int , str ]: ... @overload def process ( response : bytes ) -> str : ... def process ( response ): ... # actual implementation goes here\n```",
    "signature": "@ typing. overload",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.overload"
  },
  "typing.cast": {
    "summary": "Cast a value to a type.",
    "content": "typing. cast ( typ , val )\n\nCast a value to a type.\n\nThis returns the value unchanged. To the type checker this signals that the return value has the designated type, but at runtime we intentionally don’t check anything (we want this to be as fast as possible).",
    "signature": "typing. cast ( typ , val )",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.cast"
  },
  "typing.TYPE_CHECKING": {
    "summary": "A special constant that is assumed to be True by 3rd party static type checkers. It is False at runtime.",
    "content": "typing. TYPE_CHECKING\n\nA special constant that is assumed to be True by 3rd party static type checkers. It is False at runtime.\n\nif TYPE_CHECKING : import expensive_mod def fun ( arg : 'expensive_mod.SomeType' ) -> None : local_var : expensive_mod . AnotherType = other_fun () The first type annotation must be enclosed in quotes, making it a “forward reference”, to hide the expensive_mod reference from the interpreter runtime. Type annotations for local variables are not evaluated, so the second annotation does not need to be enclosed in quotes.\n\n```python\nif TYPE_CHECKING : import expensive_mod def fun ( arg : 'expensive_mod.SomeType' ) -> None : local_var : expensive_mod . AnotherType = other_fun ()\n```",
    "signature": "typing. TYPE_CHECKING",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.TYPE_CHECKING"
  },
  "typing.NamedTuple": {
    "summary": "Typed version of collections.namedtuple() .",
    "content": "class typing. NamedTuple\n\nTyped version of collections.namedtuple() .\n\nclass Employee ( NamedTuple ): name : str id : int This is equivalent to:\n\nEmployee = collections . namedtuple ( 'Employee' , [ 'name' , 'id' ]) To give a field a default value, you can assign to it in the class body:\n\n```python\nclass Employee ( NamedTuple ): name : str id : int\n```\n\n```python\nEmployee = collections . namedtuple ( 'Employee' , [ 'name' , 'id' ])\n```",
    "signature": "class typing. NamedTuple",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.NamedTuple"
  },
  "typing.TypeAlias": {
    "summary": "Special annotation for explicitly declaring a type alias .",
    "content": "typing. TypeAlias\n\nSpecial annotation for explicitly declaring a type alias .\n\nFor example:\n\nfrom typing import TypeAlias Factors : TypeAlias = list [ int ] TypeAlias is particularly useful on older Python versions for annotating aliases that make use of forward references, as it can be hard for type checkers to distinguish these from normal variable assignments:\n\nfrom typing import Generic , TypeAlias , TypeVar T = TypeVar ( \"T\" ) # \"Box\" does not exist yet, # so we have to use quotes for the forward reference on Python <3.12. # Using ``TypeAlias`` tells the type checker that this is a type alias declaration, # not a variable assignment to a string. BoxOfStrings : TypeAlias = \"Box[str]\" class Box ( Generic [ T ]): @classmethod def make_box_of_strings ( cls ) -> BoxOfStrings : ... See PEP 613 for more details.\n\n```python\nfrom typing import TypeAlias Factors : TypeAlias = list [ int ]\n```\n\n```python\nfrom typing import Generic , TypeAlias , TypeVar T = TypeVar ( \"T\" ) # \"Box\" does not exist yet, # so we have to use quotes for the forward reference on Python <3.12. # Using ``TypeAlias`` tells the type checker that this is a type alias declaration, # not a variable assignment to a string. BoxOfStrings : TypeAlias = \"Box[str]\" class Box ( Generic [ T ]): @classmethod def make_box_of_strings ( cls ) -> BoxOfStrings : ...\n```",
    "signature": "typing. TypeAlias",
    "url": "https://docs.python.org/3.13/library/typing.html#typing.TypeAlias"
  },
  "contextlib.contextmanager": {
    "summary": "This function is a decorator that can be used to define a factory function for with statement context managers, without needing to create a class or separate __enter__() and __exit__() methods.",
    "content": "@ contextlib. contextmanager\n\nThis function is a decorator that can be used to define a factory function for with statement context managers, without needing to create a class or separate __enter__() and __exit__() methods.\n\nWhile many objects natively support use in with statements, sometimes a resource needs to be managed that isn’t a context manager in its own right, and doesn’t implement a close() method for use with contextlib.closing .\n\nAn abstract example would be the following to ensure correct resource management:\n\nfrom contextlib import contextmanager @contextmanager def managed_resource ( * args , ** kwds ): # Code to acquire resource, e.g.: resource = acquire_resource ( * args , ** kwds ) try : yield resource finally : # Code to release resource, e.g.: release_resource ( resource ) The function can then be used like this:\n\n```python\nfrom contextlib import contextmanager @contextmanager def managed_resource ( * args , ** kwds ): # Code to acquire resource, e.g.: resource = acquire_resource ( * args , ** kwds ) try : yield resource finally : # Code to release resource, e.g.: release_resource ( resource )\n```\n\n```python\n>>> with managed_resource ( timeout = 3600 ) as resource : ... # Resource is released at the end of this block, ... # even if code in the block raises an exception\n```",
    "signature": "@ contextlib. contextmanager",
    "url": "https://docs.python.org/3.13/library/contextlib.html#contextlib.contextmanager"
  },
  "contextlib.asynccontextmanager": {
    "summary": "Similar to contextmanager() , but creates an asynchronous context manager .",
    "content": "@ contextlib. asynccontextmanager\n\nSimilar to contextmanager() , but creates an asynchronous context manager .\n\nThis function is a decorator that can be used to define a factory function for async with statement asynchronous context managers, without needing to create a class or separate __aenter__() and __aexit__() methods. It must be applied to an asynchronous generator function.\n\nA simple example:\n\nfrom contextlib import asynccontextmanager @asynccontextmanager async def get_connection (): conn = await acquire_db_connection () try : yield conn finally : await release_db_connection ( conn ) async def get_all_users (): async with get_connection () as conn : return conn . query ( 'SELECT ...' ) Added in version 3.7.\n\n```python\nfrom contextlib import asynccontextmanager @asynccontextmanager async def get_connection (): conn = await acquire_db_connection () try : yield conn finally : await release_db_connection ( conn ) async def get_all_users (): async with get_connection () as conn : return conn . query ( 'SELECT ...' )\n```\n\n```python\nimport time from contextlib import asynccontextmanager @asynccontextmanager async def timeit (): now = time . monotonic () try : yield finally : print ( f 'it took { time . monotonic () - now } s to run' ) @timeit () async def main (): # ... async code ...\n```",
    "signature": "@ contextlib. asynccontextmanager",
    "url": "https://docs.python.org/3.13/library/contextlib.html#contextlib.asynccontextmanager"
  },
  "contextlib.suppress": {
    "summary": "Return a context manager that suppresses any of the specified exceptions if they occur in the body of a with statement and then resumes execution with the first statement following the end of the with statement.",
    "content": "contextlib. suppress ( * exceptions )\n\nReturn a context manager that suppresses any of the specified exceptions if they occur in the body of a with statement and then resumes execution with the first statement following the end of the with statement.\n\nAs with any other mechanism that completely suppresses exceptions, this context manager should be used only to cover very specific errors where silently continuing with program execution is known to be the right thing to do.\n\nFor example:\n\nfrom contextlib import suppress with suppress ( FileNotFoundError ): os . remove ( 'somefile.tmp' ) with suppress ( FileNotFoundError ): os . remove ( 'someotherfile.tmp' ) This code is equivalent to:\n\n```python\nfrom contextlib import suppress with suppress ( FileNotFoundError ): os . remove ( 'somefile.tmp' ) with suppress ( FileNotFoundError ): os . remove ( 'someotherfile.tmp' )\n```\n\n```python\ntry : os . remove ( 'somefile.tmp' ) except FileNotFoundError : pass try : os . remove ( 'someotherfile.tmp' ) except FileNotFoundError : pass\n```",
    "signature": "contextlib. suppress ( * exceptions )",
    "url": "https://docs.python.org/3.13/library/contextlib.html#contextlib.suppress"
  },
  "copy.copy": {
    "summary": "Return a shallow copy of obj .",
    "content": "copy. copy ( obj )\n\nReturn a shallow copy of obj .",
    "signature": "copy. copy ( obj )",
    "url": "https://docs.python.org/3.13/library/copy.html#copy.copy"
  },
  "copy.deepcopy": {
    "summary": "Return a deep copy of obj .",
    "content": "copy. deepcopy ( obj [ , memo ] )\n\nReturn a deep copy of obj .",
    "signature": "copy. deepcopy ( obj [ , memo ] )",
    "url": "https://docs.python.org/3.13/library/copy.html#copy.deepcopy"
  },
  "subprocess.run": {
    "summary": "Run the command described by args . Wait for command to complete, then return a CompletedProcess instance.",
    "content": "subprocess. run ( args , * , stdin = None , input = None , stdout = None , stderr = None , capture_output = False , shell = False , cwd = None , timeout = None , check = False , encoding = None , errors = None , text = None , env = None , universal_newlines = None , ** other_popen_kwargs )\n\nRun the command described by args . Wait for command to complete, then return a CompletedProcess instance.\n\nThe arguments shown above are merely the most common ones, described below in Frequently Used Arguments (hence the use of keyword-only notation in the abbreviated signature). The full function signature is largely the same as that of the Popen constructor - most of the arguments to this function are passed through to that interface. ( timeout , input , check , and capture_output are not.)\n\nIf capture_output is true, stdout and stderr will be captured. When used, the internal Popen object is automatically created with stdout and stderr both set to PIPE . The stdout and stderr arguments may not be supplied at the same time as capture_output . If you wish to capture and combine both streams into one, set stdout to PIPE and stderr to STDOUT , instead of using capture_output .\n\nA timeout may be specified in seconds, it is internally passed on to Popen.communicate() . If the timeout expires, the child process will be killed and waited for. The TimeoutExpired exception will be re-raised after the child process has terminated. The initial process creation itself cannot be interrupted on many…",
    "signature": "subprocess. run ( args , * , stdin = None , input = None , stdout = None , stderr = None , capture_output = False , shell = False , cwd = None , timeout = None , check = False , encoding = None , errors = None , text = None , env = None , universal_newlines = None , ** other_popen_kwargs )",
    "url": "https://docs.python.org/3.13/library/subprocess.html#subprocess.run"
  },
  "subprocess.Popen": {
    "summary": "Execute a child program in a new process. On POSIX, the class uses os.execvpe() -like behavior to execute the child program. On Windows, the class uses the Windows CreateProcess() function. The arguments to Popen are as follows.",
    "content": "class subprocess. Popen ( args , bufsize = -1 , executable = None , stdin = None , stdout = None , stderr = None , preexec_fn = None , close_fds = True , shell = False , cwd = None , env = None , universal_newlines = None , startupinfo = None , creationflags = 0 , restore_signals = True , start_new_session = False , pass_fds = () , * , group = None , extra_groups = None , user = None , umask = -1 , encoding = None , errors = None , text = None , pipesize = -1 , process_group = None )\n\nExecute a child program in a new process. On POSIX, the class uses os.execvpe() -like behavior to execute the child program. On Windows, the class uses the Windows CreateProcess() function. The arguments to Popen are as follows.\n\nargs should be a sequence of program arguments or else a single string or path-like object . By default, the program to execute is the first item in args if args is a sequence. If args is a string, the interpretation is platform-dependent and described below. See the shell and executable arguments for additional differences from the default behavior. Unless otherwise stated, it is recommended to pass args as a sequence.\n\nFor maximum reliability, use a fully qualified path for the executable. To search for an unqualified name on PATH , use shutil.which() . On all platforms, passing sys.executable is the recommended way to launch the current Python interpreter again, and use the -m command-line format to launch an installed module.\n\n```python\nPopen ([ \"/usr/bin/git\" , \"co…",
    "signature": "class subprocess. Popen ( args , bufsize = -1 , executable = None , stdin = None , stdout = None , stderr = None , preexec_fn = None , close_fds = True , shell = False , cwd = None , env = None , universal_newlines = None , startupinfo = None , creationflags = 0 , restore_signals = True , start_new_session = False , pass_fds = () , * , group = None , extra_groups = None , user = None , umask = -1 , encoding = None , errors = None , text = None , pipesize = -1 , process_group = None )",
    "url": "https://docs.python.org/3.13/library/subprocess.html#subprocess.Popen"
  },
  "threading.Thread": {
    "summary": "This constructor should always be called with keyword arguments. Arguments are:",
    "content": "class threading. Thread ( group = None , target = None , name = None , args = () , kwargs = {} , * , daemon = None )\n\nThis constructor should always be called with keyword arguments. Arguments are:\n\ngroup should be None ; reserved for future extension when a ThreadGroup class is implemented.\n\ntarget is the callable object to be invoked by the run() method. Defaults to None , meaning nothing is called.\n\nname is the thread name. By default, a unique name is constructed of the form “Thread- N ” where N is a small decimal number, or “Thread- N (target)” where “target” is target.__name__ if the target argument is specified.",
    "signature": "class threading. Thread ( group = None , target = None , name = None , args = () , kwargs = {} , * , daemon = None )",
    "url": "https://docs.python.org/3.13/library/threading.html#threading.Thread"
  },
  "threading.Lock": {
    "summary": "The class implementing primitive lock objects. Once a thread has acquired a lock, subsequent attempts to acquire it block, until it is released; any thread may release it.",
    "content": "class threading. Lock\n\nThe class implementing primitive lock objects. Once a thread has acquired a lock, subsequent attempts to acquire it block, until it is released; any thread may release it.\n\nChanged in version 3.13: Lock is now a class. In earlier Pythons, Lock was a factory function which returned an instance of the underlying private lock type.\n\nAcquire a lock, blocking or non-blocking.\n\nWhen invoked with the blocking argument set to True (the default), block until the lock is unlocked, then set it to locked and return True .",
    "signature": "class threading. Lock",
    "url": "https://docs.python.org/3.13/library/threading.html#threading.Lock"
  },
  "asyncio.run": {
    "summary": "Execute the coroutine coro and return the result.",
    "content": "asyncio. run ( coro , * , debug = None , loop_factory = None )\n\nExecute the coroutine coro and return the result.\n\nThis function runs the passed coroutine, taking care of managing the asyncio event loop, finalizing asynchronous generators , and closing the executor.\n\nThis function cannot be called when another asyncio event loop is running in the same thread.\n\nIf debug is True , the event loop will be run in debug mode. False disables debug mode explicitly. None is used to respect the global Debug Mode settings.\n\n```python\nasync def main (): await asyncio . sleep ( 1 ) print ( 'hello' ) asyncio . run ( main ())\n```",
    "signature": "asyncio. run ( coro , * , debug = None , loop_factory = None )",
    "url": "https://docs.python.org/3.13/library/asyncio-runner.html#asyncio.run"
  },
  "asyncio.Event": {
    "summary": "An event object. Not thread-safe.",
    "content": "class asyncio. Event\n\nAn event object. Not thread-safe.\n\nAn asyncio event can be used to notify multiple asyncio tasks that some event has happened.\n\nAn Event object manages an internal flag that can be set to true with the set() method and reset to false with the clear() method. The wait() method blocks until the flag is set to true . The flag is set to false initially.\n\nChanged in version 3.10: Removed the loop parameter.\n\n```python\nasync def waiter ( event ): print ( 'waiting for it ...' ) await event . wait () print ( '... got it!' ) async def main (): # Create an Event object. event = asyncio . Event () # Spawn a Task to wait until 'event' is set. waiter_task = asyncio . create_task ( waiter ( event )) # Sleep for 1 second and set the event. await asyncio . sleep ( 1 ) event . set () # Wait until the waiter task is finished. await waiter_task asyncio . run ( main ())\n```",
    "signature": "class asyncio. Event",
    "url": "https://docs.python.org/3.13/library/asyncio-sync.html#asyncio.Event"
  },
  "asyncio.Semaphore": {
    "summary": "A Semaphore object. Not thread-safe.",
    "content": "class asyncio. Semaphore ( value = 1 )\n\nA Semaphore object. Not thread-safe.\n\nA semaphore manages an internal counter which is decremented by each acquire() call and incremented by each release() call. The counter can never go below zero; when acquire() finds that it is zero, it blocks, waiting until some task calls release() .\n\nThe optional value argument gives the initial value for the internal counter ( 1 by default). If the given value is less than 0 a ValueError is raised.\n\nChanged in version 3.10: Removed the loop parameter.\n\n```python\nsem = asyncio . Semaphore ( 10 ) # ... later async with sem : # work with shared resource\n```\n\n```python\nsem = asyncio . Semaphore ( 10 ) # ... later await sem . acquire () try : # work with shared resource finally : sem . release ()\n```",
    "signature": "class asyncio. Semaphore ( value = 1 )",
    "url": "https://docs.python.org/3.13/library/asyncio-sync.html#asyncio.Semaphore"
  },
  "asyncio.sleep": {
    "summary": "Block for delay seconds.",
    "content": "async asyncio. sleep ( delay , result = None )\n\nBlock for delay seconds.\n\nIf result is provided, it is returned to the caller when the coroutine completes.\n\nsleep() always suspends the current task, allowing other tasks to run.\n\nSetting the delay to 0 provides an optimized path to allow other tasks to run. This can be used by long-running functions to avoid blocking the event loop for the full duration of the function call.\n\n```python\nimport asyncio import datetime as dt async def display_date (): loop = asyncio . get_running_loop () end_time = loop . time () + 5.0 while True : print ( dt . datetime . now ()) if ( loop . time () + 1.0 ) >= end_time : break await asyncio . sleep ( 1 ) asyncio . run ( display_date ())\n```",
    "signature": "async asyncio. sleep ( delay , result = None )",
    "url": "https://docs.python.org/3.13/library/asyncio-task.html#asyncio.sleep"
  },
  "asyncio.gather": {
    "summary": "Run awaitable objects in the aws sequence concurrently .",
    "content": "awaitable asyncio. gather ( * aws , return_exceptions = False )\n\nRun awaitable objects in the aws sequence concurrently .\n\nIf any awaitable in aws is a coroutine, it is automatically scheduled as a Task.\n\nIf all awaitables are completed successfully, the result is an aggregate list of returned values. The order of result values corresponds to the order of awaitables in aws .\n\nIf return_exceptions is False (default), the first raised exception is immediately propagated to the task that awaits on gather() . Other awaitables in the aws sequence won’t be cancelled and will continue to run.",
    "signature": "awaitable asyncio. gather ( * aws , return_exceptions = False )",
    "url": "https://docs.python.org/3.13/library/asyncio-task.html#asyncio.gather"
  },
  "asyncio.create_task": {
    "summary": "Wrap the coro coroutine into a Task and schedule its execution. Return the Task object.",
    "content": "asyncio. create_task ( coro , * , name = None , context = None )\n\nWrap the coro coroutine into a Task and schedule its execution. Return the Task object.\n\nIf name is not None , it is set as the name of the task using Task.set_name() .\n\nAn optional keyword-only context argument allows specifying a custom contextvars.Context for the coro to run in. The current context copy is created when no context is provided.\n\nThe task is executed in the loop returned by get_running_loop() , RuntimeError is raised if there is no running loop in current thread.\n\n```python\nbackground_tasks = set () for i in range ( 10 ): task = asyncio . create_task ( some_coro ( param = i )) # Add task to the set. This creates a strong reference. background_tasks . add ( task ) # To prevent keeping references to finished tasks forever, # make each task remove its own reference from the set after # completion: task . add_done_callback ( background_tasks . discard )\n```",
    "signature": "asyncio. create_task ( coro , * , name = None , context = None )",
    "url": "https://docs.python.org/3.13/library/asyncio-task.html#asyncio.create_task"
  },
  "asyncio.Task": {
    "summary": "A Future-like object that runs a Python coroutine . Not thread-safe.",
    "content": "class asyncio. Task ( coro , * , loop = None , name = None , context = None , eager_start = False )\n\nA Future-like object that runs a Python coroutine . Not thread-safe.\n\nTasks are used to run coroutines in event loops. If a coroutine awaits on a Future, the Task suspends the execution of the coroutine and waits for the completion of the Future. When the Future is done , the execution of the wrapped coroutine resumes.\n\nEvent loops use cooperative scheduling: an event loop runs one Task at a time. While a Task awaits for the completion of a Future, the event loop runs other Tasks, callbacks, or performs IO operations.\n\nUse the high-level asyncio.create_task() function to create Tasks, or the low-level loop.create_task() or ensure_future() functions. Manual instantiation of Tasks is discouraged.",
    "signature": "class asyncio. Task ( coro , * , loop = None , name = None , context = None , eager_start = False )",
    "url": "https://docs.python.org/3.13/library/asyncio-task.html#asyncio.Task"
  },
  "asyncio.Queue": {
    "summary": "A first in, first out (FIFO) queue.",
    "content": "class asyncio. Queue ( maxsize = 0 )\n\nA first in, first out (FIFO) queue.\n\nIf maxsize is less than or equal to zero, the queue size is infinite. If it is an integer greater than 0 , then await put() blocks when the queue reaches maxsize until an item is removed by get() .\n\nUnlike the standard library threading queue , the size of the queue is always known and can be returned by calling the qsize() method.\n\nChanged in version 3.10: Removed the loop parameter.",
    "signature": "class asyncio. Queue ( maxsize = 0 )",
    "url": "https://docs.python.org/3.13/library/asyncio-queue.html#asyncio.Queue"
  },
  "enum.Enum": {
    "summary": "Enum is the base class for all enum enumerations.",
    "content": "class enum. Enum\n\nEnum is the base class for all enum enumerations.\n\nThe name used to define the Enum member:\n\n```python\n>>> Color . BLUE . name 'BLUE'\n```",
    "signature": "class enum. Enum",
    "url": "https://docs.python.org/3.13/library/enum.html#enum.Enum"
  },
  "enum.IntEnum": {
    "summary": "IntEnum is the same as Enum , but its members are also integers and can be used anywhere that an integer can be used. If any integer operation is performed with an IntEnum member, the resulting value loses its enumeration status.",
    "content": "class enum. IntEnum\n\nIntEnum is the same as Enum , but its members are also integers and can be used anywhere that an integer can be used. If any integer operation is performed with an IntEnum member, the resulting value loses its enumeration status.\n\n>>> from enum import IntEnum >>> class Number ( IntEnum ): ... ONE = 1 ... TWO = 2 ... THREE = 3 ... >>> Number . THREE <Number.THREE: 3> >>> Number . ONE + Number . TWO 3 >>> Number . THREE + 5 8 >>> Number . THREE == 3 True Note\n\nUsing auto with IntEnum results in integers of increasing value, starting with 1 .\n\nChanged in version 3.11: __str__() is now int.__str__() to better support the replacement of existing constants use-case. __format__() was already int.__format__() for that same reason.\n\n```python\n>>> from enum import IntEnum >>> class Number ( IntEnum ): ... ONE = 1 ... TWO = 2 ... THREE = 3 ... >>> Number . THREE <Number.THREE: 3> >>> Number . ONE + Number . TWO 3 >>> Number . THREE + 5 8 >>> Number . THREE == 3 True\n```",
    "signature": "class enum. IntEnum",
    "url": "https://docs.python.org/3.13/library/enum.html#enum.IntEnum"
  },
  "enum.StrEnum": {
    "summary": "StrEnum is the same as Enum , but its members are also strings and can be used in most of the same places that a string can be used. The result of any string operation performed on or with a StrEnum member is not part of the enumeration.",
    "content": "class enum. StrEnum\n\nStrEnum is the same as Enum , but its members are also strings and can be used in most of the same places that a string can be used. The result of any string operation performed on or with a StrEnum member is not part of the enumeration.\n\n>>> from enum import StrEnum , auto >>> class Color ( StrEnum ): ... RED = 'r' ... GREEN = 'g' ... BLUE = 'b' ... UNKNOWN = auto () ... >>> Color . RED <Color.RED: 'r'> >>> Color . UNKNOWN <Color.UNKNOWN: 'unknown'> >>> str ( Color . UNKNOWN ) 'unknown' Note\n\nThere are places in the stdlib that check for an exact str instead of a str subclass (i.e. type(unknown) == str instead of isinstance(unknown, str) ), and in those locations you will need to use str(MyStrEnum.MY_MEMBER) .\n\n```python\n>>> from enum import StrEnum , auto >>> class Color ( StrEnum ): ... RED = 'r' ... GREEN = 'g' ... BLUE = 'b' ... UNKNOWN = auto () ... >>> Color . RED <Color.RED: 'r'> >>> Color . UNKNOWN <Color.UNKNOWN: 'unknown'> >>> str ( Color . UNKNOWN ) 'unknown'\n```",
    "signature": "class enum. StrEnum",
    "url": "https://docs.python.org/3.13/library/enum.html#enum.StrEnum"
  },
  "enum.Flag": {
    "summary": "Flag is the same as Enum , but its members support the bitwise operators & ( AND ), | ( OR ), ^ ( XOR ), and ~ ( INVERT ); the results of those operations are (aliases of) members of the enumeration.",
    "content": "class enum. Flag\n\nFlag is the same as Enum , but its members support the bitwise operators & ( AND ), | ( OR ), ^ ( XOR ), and ~ ( INVERT ); the results of those operations are (aliases of) members of the enumeration.\n\nReturns True if value is in self:\n\n```python\n>>> from enum import Flag , auto >>> class Color ( Flag ): ... RED = auto () ... GREEN = auto () ... BLUE = auto () ... >>> purple = Color . RED | Color . BLUE >>> white = Color . RED | Color . GREEN | Color . BLUE >>> Color . GREEN in purple False >>> Color . GREEN in white True >>> purple in white True >>> white in purple False\n```",
    "signature": "class enum. Flag",
    "url": "https://docs.python.org/3.13/library/enum.html#enum.Flag"
  },
  "sys.argv": {
    "summary": "The list of command line arguments passed to a Python script. argv[0] is the script name (it is operating system dependent whether this is a full pathname or not). If the command was executed using the -c command line option to the interpreter, argv[0] is set to the string '-c' . If no script name was passed to the Python interpreter, argv[0] is the empty string.",
    "content": "sys. argv\n\nThe list of command line arguments passed to a Python script. argv[0] is the script name (it is operating system dependent whether this is a full pathname or not). If the command was executed using the -c command line option to the interpreter, argv[0] is set to the string '-c' . If no script name was passed to the Python interpreter, argv[0] is the empty string.\n\nTo loop over the standard input, or the list of files given on the command line, see the fileinput module.\n\nSee also sys.orig_argv .",
    "signature": "sys. argv",
    "url": "https://docs.python.org/3.13/library/sys.html#sys.argv"
  },
  "sys.path": {
    "summary": "A list of strings that specifies the search path for modules. Initialized from the environment variable PYTHONPATH , plus an installation-dependent default.",
    "content": "sys. path\n\nA list of strings that specifies the search path for modules. Initialized from the environment variable PYTHONPATH , plus an installation-dependent default.\n\nBy default, as initialized upon program startup, a potentially unsafe path is prepended to sys.path ( before the entries inserted as a result of PYTHONPATH ):\n\npython -m module command line: prepend the current working directory.\n\npython script.py command line: prepend the script’s directory. If it’s a symbolic link, resolve symbolic links.",
    "signature": "sys. path",
    "url": "https://docs.python.org/3.13/library/sys.html#sys.path"
  },
  "sys.exit": {
    "summary": "Raise a SystemExit exception, signaling an intention to exit the interpreter.",
    "content": "sys. exit ( [ arg ] )\n\nRaise a SystemExit exception, signaling an intention to exit the interpreter.\n\nThe optional argument arg can be an integer giving the exit status (defaulting to zero), or another type of object. If it is an integer, zero is considered “successful termination” and any nonzero value is considered “abnormal termination” by shells and the like. Most systems require it to be in the range 0–127, and produce undefined results otherwise. Some systems have a convention for assigning specific meanings to specific exit codes, but these are generally underdeveloped; Unix programs generally use 2 for command line syntax errors and 1 for all other kinds of errors. If another type of object is passed, None is equivalent to passing zero, and any other object is printed to stderr and results in an exit code of 1. In particular, sys.exit(\"some error message\") is a quick way to exit a program when an error occurs.\n\nSince exit() ultimately “only” raises an exception, it will only exit the process when called from the main thread, and the exception is not intercepted. Cleanup actions specified by finally clauses of try statements are honored, and it is possible to intercept the exit attempt at an outer level.\n\nChanged in version 3.6: If an error occurs in the cleanup after the Python interpreter has caught SystemExit (such as an error flushing buffered data in the standard streams), the exit status is changed to 120.",
    "signature": "sys. exit ( [ arg ] )",
    "url": "https://docs.python.org/3.13/library/sys.html#sys.exit"
  },
  "sys.stdout": {
    "summary": "File objects used by the interpreter for standard input, output and errors:",
    "content": "sys. stdout ¶ sys. stderr\n\nFile objects used by the interpreter for standard input, output and errors:\n\nstdin is used for all interactive input (including calls to input() );\n\nstdout is used for the output of print() and expression statements and for the prompts of input() ;\n\nThe interpreter’s own prompts and its error messages go to stderr .",
    "signature": "sys. stdout ¶ sys. stderr",
    "url": "https://docs.python.org/3.13/library/sys.html#sys.stdout"
  },
  "sys.stderr": {
    "summary": "File objects used by the interpreter for standard input, output and errors:",
    "content": "sys. stderr\n\nFile objects used by the interpreter for standard input, output and errors:\n\nstdin is used for all interactive input (including calls to input() );\n\nstdout is used for the output of print() and expression statements and for the prompts of input() ;\n\nThe interpreter’s own prompts and its error messages go to stderr .",
    "signature": "sys. stderr",
    "url": "https://docs.python.org/3.13/library/sys.html#sys.stderr"
  },
  "sys.stdin": {
    "summary": "File objects used by the interpreter for standard input, output and errors:",
    "content": "sys. stdin ¶ sys. stdout ¶ sys. stderr\n\nFile objects used by the interpreter for standard input, output and errors:\n\nstdin is used for all interactive input (including calls to input() );\n\nstdout is used for the output of print() and expression statements and for the prompts of input() ;\n\nThe interpreter’s own prompts and its error messages go to stderr .",
    "signature": "sys. stdin ¶ sys. stdout ¶ sys. stderr",
    "url": "https://docs.python.org/3.13/library/sys.html#sys.stdin"
  },
  "sys.modules": {
    "summary": "This is a dictionary that maps module names to modules which have already been loaded. This can be manipulated to force reloading of modules and other tricks. However, replacing the dictionary will not necessarily work as expected and deleting essential items from the dictionary may cause Python to fail. If you want to iterate over this global dictionary always use sys.modules.copy() or tuple(sys.modules) to avoid exceptions as its size may change during iteration as a side effect of code or activity in other threads.",
    "content": "sys. modules\n\nThis is a dictionary that maps module names to modules which have already been loaded. This can be manipulated to force reloading of modules and other tricks. However, replacing the dictionary will not necessarily work as expected and deleting essential items from the dictionary may cause Python to fail. If you want to iterate over this global dictionary always use sys.modules.copy() or tuple(sys.modules) to avoid exceptions as its size may change during iteration as a side effect of code or activity in other threads.",
    "signature": "sys. modules",
    "url": "https://docs.python.org/3.13/library/sys.html#sys.modules"
  },
  "sys.version": {
    "summary": "A string containing the version number of the Python interpreter plus additional information on the build number and compiler used. This string is displayed when the interactive interpreter is started. Do not extract version information out of it, rather, use version_info and the functions provided by the platform module.",
    "content": "sys. version\n\nA string containing the version number of the Python interpreter plus additional information on the build number and compiler used. This string is displayed when the interactive interpreter is started. Do not extract version information out of it, rather, use version_info and the functions provided by the platform module.",
    "signature": "sys. version",
    "url": "https://docs.python.org/3.13/library/sys.html#sys.version"
  },
  "sys.platform": {
    "summary": "A string containing a platform identifier. Known values are:",
    "content": "sys. platform\n\nA string containing a platform identifier. Known values are:\n\nplatform value\n\n```python\nif sys . platform . startswith ( 'freebsd' ): # FreeBSD-specific code here...\n```",
    "signature": "sys. platform",
    "url": "https://docs.python.org/3.13/library/sys.html#sys.platform"
  },
  "unittest.mock.Mock": {
    "summary": "Create a new Mock object. Mock takes several optional arguments that specify the behaviour of the Mock object:",
    "content": "class unittest.mock. Mock ( spec = None , side_effect = None , return_value = DEFAULT , wraps = None , name = None , spec_set = None , unsafe = False , ** kwargs )\n\nCreate a new Mock object. Mock takes several optional arguments that specify the behaviour of the Mock object:\n\nspec : This can be either a list of strings or an existing object (a class or instance) that acts as the specification for the mock object. If you pass in an object then a list of strings is formed by calling dir on the object (excluding unsupported magic attributes and methods). Accessing any attribute not in this list will raise an AttributeError .\n\nIf spec is an object (rather than a list of strings) then __class__ returns the class of the spec object. This allows mocks to pass isinstance() tests.\n\nspec_set : A stricter variant of spec . If used, attempting to set or get an attribute on the mock that isn’t on the object passed as spec_set will raise an AttributeError .\n\n```python\n>>> mock = Mock () >>> mock . method () <Mock name='mock.method()' id='...'> >>> mock . method . assert_called ()\n```",
    "signature": "class unittest.mock. Mock ( spec = None , side_effect = None , return_value = DEFAULT , wraps = None , name = None , spec_set = None , unsafe = False , ** kwargs )",
    "url": "https://docs.python.org/3.13/library/unittest.mock.html#unittest.mock.Mock"
  },
  "unittest.mock.patch": {
    "summary": "patch() acts as a function decorator, class decorator or a context manager. Inside the body of the function or with statement, the target is patched with a new object. When the function/with statement exits the patch is undone.",
    "content": "unittest.mock. patch ( target , new = DEFAULT , spec = None , create = False , spec_set = None , autospec = None , new_callable = None , ** kwargs )\n\npatch() acts as a function decorator, class decorator or a context manager. Inside the body of the function or with statement, the target is patched with a new object. When the function/with statement exits the patch is undone.\n\nIf new is omitted, then the target is replaced with an AsyncMock if the patched object is an async function or a MagicMock otherwise. If patch() is used as a decorator and new is omitted, the created mock is passed in as an extra argument to the decorated function. If patch() is used as a context manager the created mock is returned by the context manager.\n\ntarget should be a string in the form 'package.module.ClassName' . The target is imported and the specified object replaced with the new object, so the target must be importable from the environment you are calling patch() from. The target is imported when the decorated function is executed, not at decoration time.\n\nThe spec and spec_set keyword arguments are passed to the MagicMock if patch is creating one for you.",
    "signature": "unittest.mock. patch ( target , new = DEFAULT , spec = None , create = False , spec_set = None , autospec = None , new_callable = None , ** kwargs )",
    "url": "https://docs.python.org/3.13/library/unittest.mock.html#unittest.mock.patch"
  },
  "unittest.TestCase": {
    "summary": "Instances of the TestCase class represent the logical test units in the unittest universe. This class is intended to be used as a base class, with specific tests being implemented by concrete subclasses. This class implements the interface needed by the test runner to allow it to drive the tests, and methods that the test code can use to check for and report various kinds of failure.",
    "content": "class unittest. TestCase ( methodName = 'runTest' )\n\nInstances of the TestCase class represent the logical test units in the unittest universe. This class is intended to be used as a base class, with specific tests being implemented by concrete subclasses. This class implements the interface needed by the test runner to allow it to drive the tests, and methods that the test code can use to check for and report various kinds of failure.\n\nEach instance of TestCase will run a single base method: the method named methodName . In most uses of TestCase , you will neither change the methodName nor reimplement the default runTest() method.\n\nChanged in version 3.2: TestCase can be instantiated successfully without providing a methodName . This makes it easier to experiment with TestCase from the interactive interpreter.\n\nTestCase instances provide three groups of methods: one group used to run the test, another used by the test implementation to check conditions and report failures, and some inquiry methods allowing information about the test itself to be gathered.",
    "signature": "class unittest. TestCase ( methodName = 'runTest' )",
    "url": "https://docs.python.org/3.13/library/unittest.html#unittest.TestCase"
  }
};
