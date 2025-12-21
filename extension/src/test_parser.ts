
import { DocstringParser } from '../../docs-engine/src/parsing/docstringParser';

const parser = new DocstringParser();

const sampleHelp = `The "import" statement
**********************

   import_stmt     ::= "import" module ["as" identifier] ("," module ["as" identifier])*
                   | "from" relative_module "import" identifier ["as" identifier]
                   ("," identifier ["as" identifier])*
                   | "from" relative_module "import" "(" identifier ["as" identifier]
                   ("," identifier ["as" identifier])* [","] ")"
   module          ::= (identifier ".")* identifier
   relative_module ::= "."* module | "."+

   The basic import statement (no "from" clause) is executed in two
   steps:

   1. find a module, loading and initializing it if necessary
   2. define a name or names in the local namespace for the scope
      where the "import" statement occurs.

   When the statement contains multiple clauses (separated by commas),
   the two steps are carried out separately for each clause, just as
   though the clauses had been separated into individual import
   statements.

   The details of the first step, finding and loading modules, are
   described in greater detail in the section on the import system,
   which also describes the various types of packages and modules that
   can be imported, as well as all the hooks that can be used to
   customize the import system. Note that failures in this step may
   indicate either that the module could not be located, *or* that an
   error occurred while initializing the module, which includes
   execution of the module's code.

   If the requested module is retrieved successfully, it will be made
   available in the local namespace in one of three ways:

   * If the module name is followed by "as", then the name following
     "as" is bound directly to the imported module.

   * If no other name is specified, and the module being imported is a
     top level module, the module's name is bound in the local
     namespace as a reference to the imported module.

   * If the module being imported is *not* a top level module, then the
     name of the top level package that contains the module is bound in
     the local namespace as a reference to the top level package.  The
     imported module must be accessed using its full qualified name
     rather than directly.

   The "from" form uses a slightly more complex process:

   1. find the module specified in the "from" clause, loading and
      initializing it if necessary;
   2. for each of the identifiers specified in the "import" clauses:

      1. check if the imported module has an attribute by that name
      2. if not, attempt to import a submodule with that name and then
         check the imported module again for that attribute
      3. if the attribute is not found, ImportError is raised.
      4. otherwise, a reference to that value is stored in the local
         namespace, using the name in the "as" clause if it is present,
         otherwise using the attribute name

   Examples:

      import foo                 # foo imported and bound locally
      import foo.bar.baz         # foo.bar.baz imported, foo bound locally
      import foo.bar.baz as fbb  # foo.bar.baz imported, fbb bound locally
      from foo.bar import baz    # foo.bar.baz imported and bound as baz
      from foo import attr       # foo imported and foo.attr bound as attr

   If the list of identifiers is replaced by a star ('*'), all public
   names defined in the module are bound in the local namespace for the
   scope where the "import" statement occurs.

   The *public names* defined by a module are determined by checking the
   module's namespace for a variable named "__all__"; if defined, it
   must be a sequence of strings which are names defined or imported by
   that module.  The names given in "__all__" are all considered public
   and are required to exist.  If "__all__" is not defined, the set of
   public names includes all names found in the module's namespace which
   do not begin with an underscore character ('_').  "__all__" should
   contain the entire public API. It is intended to avoid accidentally
   exporting items that are not part of the API (such as library modules
   which were imported and used within the module).

   The wild card form of import --- "from module import *" --- is only
   allowed at the module level.  Attempting to use it in class or
   function definitions will raise a "SyntaxError".

   When specifying what module to import you do not have to specify the
   absolute name of the module. When a module or package is contained
   within another package it is possible to make a relative import
   within the same top package without having to mention the package
   name. By using leading dots in the specified module or package after
   "from" you can specify how high to traverse up the current package
   hierarchy without specifying exact names. One leading dot means the
   current package where the module making the import exists. Two dots
   means up one package level. Three dots is up two levels, etc. So if
   you execute "from . import mod" from a module in the "pkg" package
   then you will end up importing "pkg.mod". If you execute "from ..sub
   import mod" from within "pkg.subpkg1" you will import
   "pkg.sub.mod". The specification for relative imports is contained in
   the Package Relative Imports section.

   importlib.import_module() is provided to support applications that
   determine dynamically the modules to be loaded.

   Raises an auditing event "import" with arguments "module",
   "filename", "sys.path", "sys.meta_path", "sys.path_hooks".

Related help topics: MODULES
`;

const result = parser.parseHelpText(sampleHelp);
console.log(result.summary);
