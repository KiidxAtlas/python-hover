import * as path from 'path';
import { TypeshedParser } from '../../src/parsing/typeshedParser';

async function runTest() {
    const mockFile = path.join(__dirname, 'mock_typeshed.pyi');

    console.log('--- Testing global function (len) ---');
    const lenResult = await TypeshedParser.parse(mockFile, 'builtins.len');
    console.log(JSON.stringify(lenResult, null, 2));

    console.log('\n--- Testing method with overloads (list.append) ---');
    const appendResult = await TypeshedParser.parse(mockFile, 'builtins.list.append');
    console.log(JSON.stringify(appendResult, null, 2));

    console.log('\n--- Testing simple method (MyClass.my_method) ---');
    const methodResult = await TypeshedParser.parse(mockFile, 'MyClass.my_method');
    console.log(JSON.stringify(methodResult, null, 2));
}

runTest().catch(console.error);
