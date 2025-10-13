/**
 * Third-Party Library Documentation
 * Provides hover documentation for popular Python libraries
 */

import { Logger } from '../services/logger';

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
        'ones': {
            name: 'numpy.ones',
            description: 'Return a new array of given shape and type, filled with ones.',
            example: `import numpy as np

# 1D array of ones
o1 = np.ones(5)
print(o1)  # [1. 1. 1. 1. 1.]

# 2D array of ones
o2 = np.ones((3, 4))
print(o2)
# [[1. 1. 1. 1.]
#  [1. 1. 1. 1.]
#  [1. 1. 1. 1.]]

# Integer ones
o_int = np.ones(3, dtype=int)
print(o_int)  # [1 1 1]`,
            url: 'https://numpy.org/doc/stable/reference/generated/numpy.ones.html'
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
    },
    matplotlib: {
        'pyplot': {
            name: 'matplotlib.pyplot',
            description: 'MATLAB-like plotting framework. Provides functions for creating visualizations.',
            example: `import matplotlib.pyplot as plt

# Simple line plot
plt.plot([1, 2, 3, 4], [1, 4, 9, 16])
plt.ylabel('y-axis')
plt.xlabel('x-axis')
plt.title('Simple Plot')
plt.show()

# Multiple plots
x = [1, 2, 3, 4, 5]
y1 = [1, 4, 9, 16, 25]
y2 = [1, 2, 3, 4, 5]

plt.plot(x, y1, label='squared')
plt.plot(x, y2, label='linear')
plt.legend()
plt.show()`,
            url: 'https://matplotlib.org/stable/api/pyplot_summary.html'
        },
        'figure': {
            name: 'matplotlib.pyplot.figure',
            description: 'Create a new figure or activate an existing figure.',
            example: `import matplotlib.pyplot as plt

# Create figure with specific size
fig = plt.figure(figsize=(10, 6))

# Add subplots
ax1 = fig.add_subplot(221)  # 2x2 grid, position 1
ax2 = fig.add_subplot(222)  # 2x2 grid, position 2

ax1.plot([1, 2, 3], [1, 4, 9])
ax2.plot([1, 2, 3], [1, 2, 3])

plt.show()`,
            url: 'https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.figure.html'
        },
        'scatter': {
            name: 'matplotlib.pyplot.scatter',
            description: 'Create a scatter plot of x vs y with varying marker size and/or color.',
            example: `import matplotlib.pyplot as plt
import numpy as np

# Simple scatter
x = np.random.rand(50)
y = np.random.rand(50)
plt.scatter(x, y)
plt.show()

# With colors and sizes
colors = np.random.rand(50)
sizes = 1000 * np.random.rand(50)
plt.scatter(x, y, c=colors, s=sizes, alpha=0.5)
plt.colorbar()
plt.show()`,
            url: 'https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.scatter.html'
        }
    },
    scipy: {
        'stats': {
            name: 'scipy.stats',
            description: 'Statistical functions and probability distributions.',
            example: `from scipy import stats
import numpy as np

# Normal distribution
data = stats.norm.rvs(loc=0, scale=1, size=1000)

# T-test
t_stat, p_value = stats.ttest_1samp(data, 0)
print(f'T-statistic: {t_stat}, P-value: {p_value}')

# Descriptive statistics
print(stats.describe(data))`,
            url: 'https://docs.scipy.org/doc/scipy/reference/stats.html'
        },
        'integrate': {
            name: 'scipy.integrate',
            description: 'Integration and ODE solvers.',
            example: `from scipy import integrate
import numpy as np

# Integrate a function
def f(x):
    return x**2

result, error = integrate.quad(f, 0, 1)
print(f'Integral: {result}')  # 0.333...

# Solve ODE
def deriv(y, t):
    return -2 * y

t = np.linspace(0, 4, 100)
y = integrate.odeint(deriv, 1.0, t)`,
            url: 'https://docs.scipy.org/doc/scipy/reference/integrate.html'
        }
    },
    sklearn: {
        'LinearRegression': {
            name: 'sklearn.linear_model.LinearRegression',
            description: 'Ordinary least squares Linear Regression.',
            example: `from sklearn.linear_model import LinearRegression
import numpy as np

# Create sample data
X = np.array([[1], [2], [3], [4], [5]])
y = np.array([2, 4, 5, 4, 5])

# Fit model
model = LinearRegression()
model.fit(X, y)

# Make predictions
predictions = model.predict([[6]])
print(f'Prediction: {predictions[0]}')

# Get coefficients
print(f'Slope: {model.coef_[0]}')
print(f'Intercept: {model.intercept_}')`,
            url: 'https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LinearRegression.html'
        },
        'train_test_split': {
            name: 'sklearn.model_selection.train_test_split',
            description: 'Split arrays or matrices into random train and test subsets.',
            example: `from sklearn.model_selection import train_test_split
import numpy as np

# Sample data
X = np.arange(100).reshape((20, 5))
y = np.arange(20)

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

print(f'Train size: {len(X_train)}')  # 16
print(f'Test size: {len(X_test)}')    # 4`,
            url: 'https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.train_test_split.html'
        }
    },
    bs4: {
        'BeautifulSoup': {
            name: 'bs4.BeautifulSoup',
            description: 'Beautiful Soup parses HTML and XML documents, even with malformed markup.',
            example: `from bs4 import BeautifulSoup

html = """
<html>
<head><title>Page Title</title></head>
<body>
    <p class="story">Once upon a time...</p>
    <a href="http://example.com">Link</a>
</body>
</html>
"""

soup = BeautifulSoup(html, 'html.parser')

# Find elements
title = soup.find('title')
print(title.text)  # "Page Title"

# Find by class
story = soup.find('p', class_='story')
print(story.text)

# Find all links
links = soup.find_all('a')
for link in links:
    print(link.get('href'))`,
            url: 'https://www.crummy.com/software/BeautifulSoup/bs4/doc/'
        }
    },
    sqlalchemy: {
        'create_engine': {
            name: 'sqlalchemy.create_engine',
            description: 'Create a new Engine instance.',
            example: `from sqlalchemy import create_engine

# SQLite in-memory
engine = create_engine('sqlite:///:memory:')

# SQLite file
engine = create_engine('sqlite:///database.db')

# PostgreSQL
engine = create_engine(
    'postgresql://user:password@localhost/dbname'
)

# MySQL
engine = create_engine(
    'mysql+pymysql://user:password@localhost/dbname'
)

# Execute query
with engine.connect() as conn:
    result = conn.execute("SELECT * FROM users")`,
            url: 'https://docs.sqlalchemy.org/en/20/core/engines.html'
        }
    },
    fastapi: {
        'FastAPI': {
            name: 'fastapi.FastAPI',
            description: 'Modern, fast web framework for building APIs with Python.',
            example: `from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}

# POST endpoint with body
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    price: float

@app.post("/items/")
def create_item(item: Item):
    return {"name": item.name, "price": item.price}

# Run with: uvicorn main:app --reload`,
            url: 'https://fastapi.tiangolo.com/'
        }
    },
    pytest: {
        'fixture': {
            name: 'pytest.fixture',
            description: 'Decorator to mark a function as a fixture factory.',
            example: `import pytest

@pytest.fixture
def sample_data():
    return [1, 2, 3, 4, 5]

@pytest.fixture
def db_connection():
    # Setup
    conn = create_connection()
    yield conn
    # Teardown
    conn.close()

def test_sum(sample_data):
    assert sum(sample_data) == 15

def test_database(db_connection):
    result = db_connection.query("SELECT 1")
    assert result == 1`,
            url: 'https://docs.pytest.org/en/stable/fixture.html'
        },
        'mark': {
            name: 'pytest.mark',
            description: 'Mark test functions with metadata.',
            example: `import pytest

@pytest.mark.slow
def test_slow_function():
    # This test is slow
    pass

@pytest.mark.parametrize("input,expected", [
    (1, 2),
    (2, 4),
    (3, 6),
])
def test_multiply_by_2(input, expected):
    assert input * 2 == expected

@pytest.mark.skip(reason="Not implemented yet")
def test_future_feature():
    pass

# Run with: pytest -m slow`,
            url: 'https://docs.pytest.org/en/stable/mark.html'
        }
    },
    selenium: {
        'webdriver': {
            name: 'selenium.webdriver',
            description: 'WebDriver implementations for browser automation.',
            example: `from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Chrome driver
driver = webdriver.Chrome()

# Navigate to URL
driver.get("https://www.example.com")

# Find element
element = driver.find_element(By.ID, "username")
element.send_keys("myusername")

# Wait for element
wait = WebDriverWait(driver, 10)
element = wait.until(
    EC.presence_of_element_located((By.ID, "submit"))
)

# Click button
element.click()

driver.quit()`,
            url: 'https://selenium-python.readthedocs.io/'
        }
    },
    asyncio: {
        'run': {
            name: 'asyncio.run',
            description: 'Execute the coroutine and return the result.',
            example: `import asyncio

async def main():
    print('Hello')
    await asyncio.sleep(1)
    print('World')

# Run async function
asyncio.run(main())

# Multiple tasks
async def fetch_data(id):
    await asyncio.sleep(1)
    return f'Data {id}'

async def main():
    tasks = [fetch_data(i) for i in range(3)]
    results = await asyncio.gather(*tasks)
    print(results)

asyncio.run(main())`,
            url: 'https://docs.python.org/3/library/asyncio-task.html#asyncio.run'
        },
        'gather': {
            name: 'asyncio.gather',
            description: 'Run awaitable objects in the sequence concurrently.',
            example: `import asyncio

async def task1():
    await asyncio.sleep(1)
    return 'Task 1'

async def task2():
    await asyncio.sleep(2)
    return 'Task 2'

async def main():
    # Run concurrently
    results = await asyncio.gather(task1(), task2())
    print(results)  # ['Task 1', 'Task 2']

asyncio.run(main())`,
            url: 'https://docs.python.org/3/library/asyncio-task.html#asyncio.gather'
        }
    },
    pydantic: {
        'BaseModel': {
            name: 'pydantic.BaseModel',
            description: 'Base class for creating data validation models.',
            example: `from pydantic import BaseModel, validator
from typing import Optional

class User(BaseModel):
    id: int
    name: str
    email: str
    age: Optional[int] = None

    @validator('email')
    def email_must_be_valid(cls, v):
        if '@' not in v:
            raise ValueError('Invalid email')
        return v

# Create instance
user = User(id=1, name='John', email='john@example.com')
print(user.dict())

# Validation error
try:
    User(id=1, name='John', email='invalid')
except ValueError as e:
    print(e)`,
            url: 'https://docs.pydantic.dev/'
        }
    },
    pillow: {
        'Image': {
            name: 'PIL.Image',
            description: 'The Image module provides a class with the same name for representing a PIL image.',
            example: `from PIL import Image

# Open image
img = Image.open('photo.jpg')

# Get info
print(img.size)     # (width, height)
print(img.format)   # JPEG
print(img.mode)     # RGB

# Resize image
img_resized = img.resize((800, 600))

# Crop image
box = (100, 100, 400, 400)
img_cropped = img.crop(box)

# Save image
img.save('output.png')

# Create new image
new_img = Image.new('RGB', (100, 100), color='red')`,
            url: 'https://pillow.readthedocs.io/en/stable/reference/Image.html'
        }
    }
};

/**
 * Detect imported libraries and their aliases
 * Returns a Map of alias -> library name
 */
/**
 * Check if a library is known (either has hardcoded docs or custom inventory)
 */
function isKnownLibrary(libraryName: string, configManager?: any): boolean {
    // Check hardcoded libraries
    if (THIRD_PARTY_LIBRARIES[libraryName]) {
        return true;
    }

    // Check custom libraries from config (if available)
    if (configManager && typeof configManager.customLibraries !== 'undefined') {
        const customLibs = configManager.customLibraries || [];
        if (customLibs.some((lib: any) => lib.name === libraryName)) {
            return true;
        }
    }

    // NEW: Track ALL third-party libraries (not just known ones)
    // This allows auto-discovery to work with any library
    // Skip Python standard library modules
    const stdlibModules = new Set([
        'os', 'sys', 'json', 'time', 'datetime', 'math', 'random', 're',
        'collections', 'itertools', 'functools', 'operator', 'pathlib',
        'typing', 'abc', 'enum', 'dataclasses', 'copy', 'pickle',
        'io', 'csv', 'xml', 'html', 'urllib', 'http', 'email',
        'threading', 'multiprocessing', 'subprocess', 'socket', 'ssl',
        'logging', 'unittest', 'argparse', 'configparser', 'tempfile',
        'shutil', 'glob', 'fnmatch', 'zipfile', 'tarfile', 'gzip',
        'sqlite3', 'hashlib', 'hmac', 'secrets', 'uuid', 'struct'
    ]);

    // If not a standard library module, treat it as a potential third-party library
    return !stdlibModules.has(libraryName);
}

export function getImportedLibraries(documentText: string, configManager?: any): Map<string, string> {
    const imports = new Map<string, string>(); // alias -> library name
    const lines = documentText.split('\n');

    for (const line of lines) {
        // Remove comments before processing
        const withoutComment = line.split('#')[0];
        const trimmed = withoutComment.trim();

        // Match: import numpy as np
        const importAsMatch = trimmed.match(/^import\s+(\w+)(?:\s+as\s+(\w+))?$/);
        if (importAsMatch) {
            const library = importAsMatch[1];
            const alias = importAsMatch[2] || library;
            if (isKnownLibrary(library, configManager)) {
                imports.set(alias, library);
            }
            continue;
        }

        // Match: from numpy import array, zeros
        // Also match: from jupyter_core import paths
        const fromMatch = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)$/);
        if (fromMatch) {
            const library = fromMatch[1].split('.')[0]; // Get base module (e.g., "jupyter_core" from "jupyter_core.paths")
            const fullModule = fromMatch[1]; // Keep full module path (e.g., "jupyter_core.paths")
            const importedItems = fromMatch[2]; // Everything after "import"

            // Check if this is a library we track
            if (isKnownLibrary(library, configManager)) {
                // DON'T add imports.set(library, library) here!
                // We're importing symbols FROM the library, not the library itself.
                // Only map the individual imported symbols.

                // Parse imported items (handle: name, name as alias, name1, name2, etc.)
                const items = importedItems.split(',').map(item => item.trim());
                for (const item of items) {
                    // Skip parentheses and handle "as" aliases
                    const cleanItem = item.replace(/[()]/g, '').trim();
                    if (!cleanItem || cleanItem === '(' || cleanItem === ')') continue;

                    const asMatch = cleanItem.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
                    if (asMatch) {
                        const name = asMatch[1];
                        const alias = asMatch[2] || name;
                        // Map the imported symbol to the library
                        // e.g., "paths" -> "jupyter_core" or "KernelManager" -> "jupyter_client"
                        imports.set(alias, library);
                        Logger.getInstance().debug(`Mapped import: ${alias} -> ${library} (from ${fullModule})`);
                    }
                }
            }
            continue;
        }

        // Match: import numpy (without alias)
        const simpleImportMatch = trimmed.match(/^import\s+(\w+)$/);
        if (simpleImportMatch) {
            const library = simpleImportMatch[1];
            if (isKnownLibrary(library, configManager)) {
                imports.set(library, library);
            }
        }
    }

    return imports;
}

/**
 * Check if a library is imported (legacy function for backward compatibility)
 */
export function getImportedLibrariesSet(documentText: string, configManager?: any): Set<string> {
    const importMap = getImportedLibraries(documentText, configManager);
    return new Set(importMap.values());
}

/**
 * Get documentation for a third-party library symbol
 */
export function getThirdPartyDoc(library: string, symbol: string): LibraryDoc | null {
    // Input validation
    if (!library || !symbol || typeof library !== 'string' || typeof symbol !== 'string') {
        return null;
    }

    const libraryDocs = THIRD_PARTY_LIBRARIES[library];
    if (!libraryDocs) {
        return null;
    }

    return libraryDocs[symbol] || null;
}
