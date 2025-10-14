# How to Test Python Hover with Different Modules

## 🚀 Quick Answer

I've created **3 test files** for you in the `examples/` folder:

1. **`test-dynamic-resolution.py`** - Comprehensive test with 10+ libraries
2. **`quick-library-test.py`** - Quick checker to see what you have installed
3. **`TESTING_GUIDE.md`** - Step-by-step testing instructions

## 📦 To Test Different Modules

### Option 1: Use Existing Test Files (Easiest)

1. **Reload VS Code Window**
   ```
   Cmd+Shift+P → Developer: Reload Window
   ```

2. **Open** `examples/quick-library-test.py`

3. **Run it** to see what libraries you have:
   ```
   Right-click → Run Python File in Terminal
   ```

4. **Open** `examples/test-dynamic-resolution.py`

5. **Hover** over any method in the sections for libraries you have installed

### Option 2: Install Specific Libraries to Test

Pick categories you want to test:

```bash
# Data Science (Most Popular)
pip install pandas numpy scipy matplotlib

# Machine Learning (Auto-Discovered!)
pip install scikit-learn torch tensorflow

# Web Development
pip install requests flask fastapi django httpx

# Data Visualization (Auto-Discovered!)
pip install plotly seaborn

# Utilities (Auto-Discovered!)
pip install beautifulsoup4 pillow sqlalchemy pydantic

# Or install everything at once:
pip install pandas numpy scikit-learn requests plotly seaborn beautifulsoup4
```

### Option 3: Test Your Own Favorite Library

1. **Install any Python library** that has Sphinx/ReadTheDocs documentation:
   ```bash
   pip install your-favorite-library
   ```

2. **Create a test file**:
   ```python
   import your_library

   obj = your_library.SomeClass()
   obj.some_method()  # Hover here!
   ```

3. **Hover** over the method - it should auto-discover and show docs! ✨

## 🎯 What to Test

### Essential Tests (Recommended)

**Test 1: Pandas DataFrame** (shows qualified names work)
```python
import pandas as pd
df = pd.DataFrame({'A': [1, 2, 3]})
df.head()  # Hover - should show "DataFrame.head" NOT "object.head"
```

**Test 2: NumPy Array**
```python
import numpy as np
arr = np.array([1, 2, 3])
arr.reshape(3, 1)  # Hover - should show "ndarray.reshape"
```

**Test 3: Auto-Discovery**
```python
import requests
response = requests.get('https://api.github.com')
response.json()  # Hover - should auto-discover requests docs!
```

**Test 4: Error Handling**
```python
import nanoid  # Has invalid docs
import pandas

df = pandas.DataFrame()
df.head()  # Hover - should STILL work despite nanoid error!
```

### Advanced Tests

**Test with Libraries You Use Daily**
- If you use scikit-learn, test `model.fit()`, `model.predict()`
- If you use Flask, test `app.route()`, `request.form.get()`
- If you use FastAPI, test `app.get()`, `app.post()`

**Test Performance**
- First hover: ~50-200ms (fetching docs)
- Second hover: <10ms (cached) ✅

## 📊 What You Should See

### ✅ Success Indicators

1. **Qualified Names** (the big fix!)
   ```
   Before: "object.head"  ❌
   Now:    "DataFrame.head" ✅
   ```

2. **Rich Documentation**
   - Summary box
   - Parameters with types
   - Return type
   - Examples

3. **Auto-Discovery Messages** (in Output panel)
   ```
   ✅ Auto-discovered requests
   [HoverProvider] Found DataFrame in library pandas
   ```

4. **No Crashes** (even with bad libraries like nanoid)

### 🔍 Check the Logs

1. Open: `View` → `Output`
2. Select: **"Python Hover"** from dropdown
3. Look for:
   ```
   [HoverProvider] Attempting to qualify simple type: DataFrame
   [HoverProvider] Trying to resolve: pandas.DataFrame
   [HoverProvider] Found DataFrame in library pandas ✅
   ```

## 🧪 Specific Module Test Examples

### Data Science Stack

```python
import pandas as pd
import numpy as np
import scipy
from sklearn.linear_model import LogisticRegression

# Hover on each of these:
df = pd.DataFrame({'A': [1, 2, 3]})
df.head()  # → "DataFrame.head"
df.describe()  # → "DataFrame.describe"

arr = np.array([1, 2, 3])
arr.reshape(3, 1)  # → "ndarray.reshape"

model = LogisticRegression()
model.fit([[1, 2]], [0])  # → "LogisticRegression.fit" (auto-discovered!)
```

### Web Development Stack

```python
import requests
from flask import Flask, request
from fastapi import FastAPI

# Hover on each:
response = requests.get('https://api.github.com')
response.json()  # → "Response.json" (auto-discovered!)

app = Flask(__name__)
app.route('/')  # → "Flask.route"

api = FastAPI()
api.get('/')  # → "FastAPI.get"
```

### Visualization Stack

```python
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px

# Hover on each:
plt.plot([1, 2, 3])  # → matplotlib docs
sns.lineplot(x=[1, 2], y=[3, 4])  # → seaborn docs (auto-discovered!)
px.scatter(x=[1, 2], y=[3, 4])  # → plotly docs (auto-discovered!)
```

## 🎓 Understanding Dynamic Resolution

### How It Works

When you hover on `df.head()`:

1. **Detects context**: "df is a DataFrame"
2. **Checks imported libraries**: ['pandas', 'numpy', 'requests']
3. **Tries each library**:
   - Try pandas.DataFrame → Check inventory → ✅ Found!
   - (Stops searching)
4. **Qualifies the type**: DataFrame → pandas.DataFrame
5. **Fetches docs**: Shows DataFrame.head() documentation

### What Makes v0.5.1 Special

**Before:**
- Hardcoded: Only worked for 3 classes (DataFrame, Series, ndarray)
- Crashed on libraries with bad docs
- Showed "object.method" often

**Now (v0.5.1):**
- ✅ Dynamic: Works with ANY library automatically
- ✅ Robust: Handles bad docs gracefully
- ✅ Smart: Shows correct qualified names (DataFrame.head)
- ✅ Fast: Cached for offline use

## 📝 Full Testing Workflow

1. **Install some test libraries**:
   ```bash
   pip install pandas numpy scikit-learn requests
   ```

2. **Reload VS Code**:
   ```
   Cmd+Shift+P → Developer: Reload Window
   ```

3. **Run the library checker**:
   - Open `examples/quick-library-test.py`
   - Run it to see what you have

4. **Open the test file**:
   - Open `examples/test-dynamic-resolution.py`

5. **Hover over methods** in sections for your installed libraries

6. **Check the Output panel**:
   - View → Output → Select "Python Hover"
   - Look for success messages

7. **Verify results**:
   - [ ] Shows qualified names (DataFrame.head, not object.head)
   - [ ] Rich documentation appears
   - [ ] Auto-discovery works for new libraries
   - [ ] No crashes even with bad libraries
   - [ ] Fast performance on second hover

## 🎯 Recommended Test Libraries

### Tier 1: Essential (Install These First)
```bash
pip install pandas numpy requests
```
These are the most common and will test all core features.

### Tier 2: Machine Learning (Tests Auto-Discovery)
```bash
pip install scikit-learn
```
Perfect for testing auto-discovery since it's not pre-configured!

### Tier 3: Web + Visualization (Tests Variety)
```bash
pip install flask plotly seaborn
```
Tests different types of libraries and auto-discovery.

### Tier 4: Stress Test (Tests Error Handling)
```bash
pip install nanoid  # Has invalid inventory - tests error handling!
```
Makes sure the extension doesn't crash with problematic libraries.

## 🐛 Troubleshooting

**Hover not showing?**
- Reload VS Code window
- Check library is imported
- Verify file is saved

**Still shows "object.method"?**
- Check Output panel for errors
- Verify library is installed
- Try reloading window

**Extension crashes?**
- Check Output panel for error messages
- Report issue with library name and error

**No auto-discovery?**
- Check internet connection (first fetch)
- Verify library has Sphinx/ReadTheDocs docs
- Check Output panel for discovery messages

## 🎉 Success!

If hovering shows:
- ✅ "DataFrame.head" instead of "object.head"
- ✅ Rich documentation with parameters
- ✅ Auto-discovery for new libraries
- ✅ No crashes with bad libraries

**Then v0.5.1 is working perfectly!** 🚀

---

**Need help?** Check `examples/TESTING_GUIDE.md` for detailed step-by-step instructions.

**Found a bug?** Report at: https://github.com/KiidxAtlas/python-hover/issues
