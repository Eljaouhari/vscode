/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { EditorSimpleWorkerImpl, ICommonModel } from 'vs/editor/common/services/editorSimpleWorker';
import { Range } from 'vs/editor/common/core/range';

suite('EditorSimpleWorker', () => {

	class WorkerWithModels extends EditorSimpleWorkerImpl {

		getModel(uri: string) {
			return this._getModel(uri);
		}

		addModel(lines: string[], eol: string = '\n') {
			const uri = 'test:file#' + Date.now();
			this.acceptNewModel({
				url: uri,
				versionId: 1,
				value: {
					EOL: eol,
					lines,
					BOM: undefined,
					containsRTL: undefined,
					length: undefined,
					options: undefined
				}
			});
			return this._getModel(uri);
		}
	}

	let worker: WorkerWithModels;
	let model: ICommonModel;

	setup(() => {
		worker = new WorkerWithModels();
		model = worker.addModel([
			'This is line one', //16
			'and this is line number two', //27
			'it is followed by #3', //20
			'and finished with the fourth.', //29
		]);
	});

	function assertPositionAt(offset: number, line: number, column: number) {
		let position = model.positionAt(offset);
		assert.equal(position.lineNumber, line);
		assert.equal(position.column, column);
	}

	function assertOffsetAt(lineNumber: number, column: number, offset: number) {
		let actual = model.offsetAt({ lineNumber, column });
		assert.equal(actual, offset);
	}

	test('ICommonModel#offsetAt', function () {
		assertOffsetAt(1, 1, 0);
		assertOffsetAt(1, 2, 1);
		assertOffsetAt(1, 17, 16);
		assertOffsetAt(2, 1, 17);
		assertOffsetAt(2, 4, 20);
		assertOffsetAt(3, 1, 45);
		assertOffsetAt(5, 30, 95);
		assertOffsetAt(5, 31, 95);
		assertOffsetAt(5, Number.MAX_VALUE, 95);
		assertOffsetAt(6, 30, 95);
		assertOffsetAt(Number.MAX_VALUE, 30, 95);
		assertOffsetAt(Number.MAX_VALUE, Number.MAX_VALUE, 95);
	});

	test('ICommonModel#positionAt', function () {
		assertPositionAt(0, 1, 1);
		assertPositionAt(Number.MIN_VALUE, 1, 1);
		assertPositionAt(1, 1, 2);
		assertPositionAt(16, 1, 17);
		assertPositionAt(17, 2, 1);
		assertPositionAt(20, 2, 4);
		assertPositionAt(45, 3, 1);
		assertPositionAt(95, 4, 30);
		assertPositionAt(96, 4, 30);
		assertPositionAt(99, 4, 30);
		assertPositionAt(Number.MAX_VALUE, 4, 30);
	});

	test('MoreMinimal', function () {

		return worker.computeMoreMinimalEdits(model.uri.toString(), [{ text: 'This is line One', range: new Range(1, 1, 1, 17) }], []).then(edits => {
			assert.equal(edits.length, 1);
			const [first] = edits;
			assert.equal(first.text, 'O');
			assert.deepEqual(first.range, { startLineNumber: 1, startColumn: 14, endLineNumber: 1, endColumn: 15 });
		});
	});

	test('MoreMinimal, issue #15385 newline changes only', function () {

		let model = worker.addModel([
			'{',
			'\t"a":1',
			'}'
		], '\n');

		return worker.computeMoreMinimalEdits(model.uri.toString(), [{ text: '{\r\n\t"a":1\r\n}', range: new Range(1, 1, 3, 2) }], []).then(edits => {
			assert.equal(edits.length, 0);
		});
	});

	test('MoreMinimal, issue #15385 newline changes and other', function () {

		let model = worker.addModel([
			'{',
			'\t"a":1',
			'}'
		], '\n');

		return worker.computeMoreMinimalEdits(model.uri.toString(), [{ text: '{\r\n\t"b":1\r\n}', range: new Range(1, 1, 3, 2) }], []).then(edits => {
			assert.equal(edits.length, 1);
			const [first] = edits;
			assert.equal(first.text, 'b');
			assert.deepEqual(first.range, { startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 4 });
		});
	});
});
