require( 'babel-register' );

const test = require( 'ava' );
const balancedDag = require( '../src' );

test( "defaultVertices", t => {
	let adjacencies = new Map([
		[ 'foo', new Set([ 'bar', 'baz' ]) ],
		[ 'bar', new Set([ 'baz' ]) ],
		[ 'baz', new Set([ 'bing' ]) ]
	]);

	let vertexMap = balancedDag.defaultVertices( adjacencies );

	let expectedVertices = new Set([ 'foo', 'bar', 'baz', 'bing' ]);

	t.plan( expectedVertices.size + 1 );

	t.is( vertexMap.size, expectedVertices.size, `generated vertex map has same number of entries as our set of expected vertex ids` );

	vertexMap.forEach( ( v, vid ) => {
		t.true( expectedVertices.has( vid ), `vertex ${ vid } is in both received and expected sets` );
	});
});
