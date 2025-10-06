/**
 * Third-Party Library Documentation
 * Provides hover documentation for popular Python libraries
 */

export interface LibraryDoc {
    name: string;
    description: string;
    example?: string;
    url?: string;
    version?: string;
}

export interface LibraryDocs {
    [key: string]: {
        [symbol: string]: LibraryDoc;
    };
}

export const THIRD_PARTY_LIBRARIES: LibraryDocs = {
    numpy: {
        'array': {
            name: 'numpy.array',
            description: 'Create an array from a Python list or tuple.',
            example: `import numpy as np

# Create 1D array
arr1d = np.array([1, 2, 3, 4, 5])
print(arr1d)  # [1 2 3 4 5]

# Create 2D array
arr2d = np.array([[1, 2, 3], [4, 5, 6]])
print(arr2d)
# [[1 2 3]
#  [4 5 6]]

# Specify dtype
arr_float = np.array([1, 2, 3], dtype=float)
print(arr_float)  # [1. 2. 3.]`,
            url: 'https://numpy.org/doc/stable/reference/generated/numpy.array.html'
        },
        'zeros': {
            name: 'numpy.zeros',
            description: 'Return a new array of given shape and type, filled with zeros.',
            example: `import numpy as np

# 1D array of zeros
z1 = np.zeros(5)
print(z1)  # [0. 0. 0. 0. 0.]

# 2D array of zeros
z2 = np.zeros((3, 4))
print(z2)
# [[0. 0. 0. 0.]
#  [0. 0. 0. 0.]
#  [0. 0. 0. 0.]]

# Integer zeros
z_int = np.zeros(3, dtype=int)
print(z_int)  # [0 0 0]`,
            url: 'https://numpy.org/doc/stable/reference/generated/numpy.zeros.html'
        },
        'arange': {
            name: 'numpy.arange',
            description: 'Return evenly spaced values within a given interval.',
            example: `import numpy as np

# Similar to Python's range
arr1 = np.arange(10)
print(arr1)  # [0 1 2 3 4 5 6 7 8 9]

# With start and stop
arr2 = np.arange(5, 10)
print(arr2)  # [5 6 7 8 9]

# With step
arr3 = np.arange(0, 1, 0.2)
print(arr3)  # [0.  0.2 0.4 0.6 0.8]`,
            url: 'https://numpy.org/doc/stable/reference/generated/numpy.arange.html'
        },
        'reshape': {
            name: 'numpy.ndarray.reshape',
            description: 'Gives a new shape to an array without changing its data.',
            example: `import numpy as np

arr = np.arange(12)
print(arr)  # [ 0  1  2  3  4  5  6  7  8  9 10 11]

# Reshape to 2D
arr_2d = arr.reshape(3, 4)
print(arr_2d)
# [[ 0  1  2  3]
#  [ 4  5  6  7]
#  [ 8  9 10 11]]

# Reshape to 3D
arr_3d = arr.reshape(2, 3, 2)
print(arr_3d.shape)  # (2, 3, 2)`,
            url: 'https://numpy.org/doc/stable/reference/generated/numpy.reshape.html'
        }
    },
    pandas: {
        'DataFrame': {
            name: 'pandas.DataFrame',
            description: 'Two-dimensional, size-mutable, potentially heterogeneous tabular data.',
            example: `import pandas as pd

# From dictionary
df = pd.DataFrame({
    'name': ['Alice', 'Bob', 'Charlie'],
    'age': [25, 30, 35],
    'city': ['NY', 'LA', 'Chicago']
})
print(df)
#       name  age     city
# 0    Alice   25       NY
# 1      Bob   30       LA
# 2  Charlie   35  Chicago

# Access columns
print(df['name'])  # Name column
print(df.age)      # Alternative access`,
            url: 'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.html'
        },
        'read_csv': {
            name: 'pandas.read_csv',
            description: 'Read a comma-separated values (csv) file into DataFrame.',
            example: `import pandas as pd

# Read CSV file
df = pd.read_csv('data.csv')

# With custom delimiter
df = pd.read_csv('data.tsv', sep='\\t')

# Skip rows and use specific columns
df = pd.read_csv('data.csv',
                 skiprows=1,
                 usecols=['name', 'age'])

# Parse dates
df = pd.read_csv('data.csv',
                 parse_dates=['date_column'])`,
            url: 'https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html'
        },
        'groupby': {
            name: 'pandas.DataFrame.groupby',
            description: 'Group DataFrame using a mapper or by a Series of columns.',
            example: `import pandas as pd

df = pd.DataFrame({
    'category': ['A', 'B', 'A', 'B', 'A'],
    'values': [10, 20, 30, 40, 50]
})

# Group by category and sum
grouped = df.groupby('category')['values'].sum()
print(grouped)
# category
# A    90
# B    60

# Multiple aggregations
agg = df.groupby('category').agg({
    'values': ['sum', 'mean', 'count']
})
print(agg)`,
            url: 'https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.groupby.html'
        },
        'merge': {
            name: 'pandas.merge',
            description: 'Merge DataFrame or named Series objects with a database-style join.',
            example: `import pandas as pd

df1 = pd.DataFrame({
    'id': [1, 2, 3],
    'name': ['Alice', 'Bob', 'Charlie']
})

df2 = pd.DataFrame({
    'id': [1, 2, 4],
    'score': [85, 92, 78]
})

# Inner join (default)
merged = pd.merge(df1, df2, on='id')
print(merged)
#    id   name  score
# 0   1  Alice     85
# 1   2    Bob     92

# Left join
left = pd.merge(df1, df2, on='id', how='left')`,
            url: 'https://pandas.pydata.org/docs/reference/api/pandas.merge.html'
        }
    },
    requests: {
        'get': {
            name: 'requests.get',
            description: 'Sends a GET request to the specified URL.',
            example: `import requests

# Simple GET request
response = requests.get('https://api.github.com')
print(response.status_code)  # 200
print(response.json())  # Parse JSON response

# With parameters
params = {'q': 'python', 'sort': 'stars'}
response = requests.get('https://api.github.com/search/repositories',
                       params=params)

# With headers
headers = {'Authorization': 'Bearer TOKEN'}
response = requests.get('https://api.example.com/data',
                       headers=headers)`,
            url: 'https://requests.readthedocs.io/en/latest/api/#requests.get'
        },
        'post': {
            name: 'requests.post',
            description: 'Sends a POST request to the specified URL.',
            example: `import requests

# POST with JSON data
data = {'username': 'user', 'password': 'pass'}
response = requests.post('https://api.example.com/login',
                        json=data)

# POST with form data
form_data = {'key1': 'value1', 'key2': 'value2'}
response = requests.post('https://api.example.com/form',
                        data=form_data)

# Check response
if response.status_code == 200:
    print('Success!')
    print(response.json())`,
            url: 'https://requests.readthedocs.io/en/latest/api/#requests.post'
        }
    },
    flask: {
        'Flask': {
            name: 'flask.Flask',
            description: 'The Flask object implements a WSGI application.',
            example: `from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    return 'Hello, World!'

@app.route('/user/<username>')
def show_user(username):
    return f'User: {username}'

if __name__ == '__main__':
    app.run(debug=True)`,
            url: 'https://flask.palletsprojects.com/en/latest/api/#flask.Flask'
        },
        'render_template': {
            name: 'flask.render_template',
            description: 'Renders a template from the template folder with the given context.',
            example: `from flask import Flask, render_template

app = Flask(__name__)

@app.route('/hello/<name>')
def hello(name):
    return render_template('hello.html',
                          name=name,
                          title='Greeting')

# hello.html:
# <!DOCTYPE html>
# <html>
# <head><title>{{ title }}</title></head>
# <body><h1>Hello, {{ name }}!</h1></body>
# </html>`,
            url: 'https://flask.palletsprojects.com/en/latest/api/#flask.render_template'
        }
    },
    django: {
        'Model': {
            name: 'django.db.models.Model',
            description: 'Base class for all Django models.',
            example: `from django.db import models

class Article(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    pub_date = models.DateTimeField(auto_now_add=True)
    author = models.ForeignKey('auth.User',
                              on_delete=models.CASCADE)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-pub_date']

# Usage:
article = Article.objects.create(
    title='My Article',
    content='Content here...',
    author=user
)`,
            url: 'https://docs.djangoproject.com/en/stable/ref/models/instances/'
        }
    }
};

/**
 * Check if a library is imported in the document
 */
export function getImportedLibraries(documentText: string): Set<string> {
    const libraries = new Set<string>();
    const importRegex = /^(?:import|from)\s+(numpy|pandas|requests|flask|django|sklearn|matplotlib|scipy|asyncio|aiohttp)\b/gm;

    let match;
    while ((match = importRegex.exec(documentText)) !== null) {
        libraries.add(match[1]);
    }

    return libraries;
}

/**
 * Get documentation for a third-party library symbol
 */
export function getThirdPartyDoc(library: string, symbol: string): LibraryDoc | null {
    const libraryDocs = THIRD_PARTY_LIBRARIES[library];
    if (!libraryDocs) {
        return null;
    }

    return libraryDocs[symbol] || null;
}
