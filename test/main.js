var chai = require("chai");
	chai.should();


describe("MySQL DSL",function() {

	var mydsl = require("../");

	it("should generate a simple select",function() {

		var query =
			mydsl
				.select("field")
				.as("fieldLabel")
				.from("myTable");

		query
			.getQuery()
			.toString()
			.should
			.equal("SELECT `myTable`.`field` AS `fieldLabel` FROM `myTable`");
	});

	it("should generate a select from a subquery",function() {
		var query =
			mydsl
				.select("field")
				.from(mydsl.select("giblets","peons").getQuery());

		query
			.getQuery()
			.toString()
			.should
			.equal("SELECT `field` FROM (SELECT `peons`.`giblets` FROM `peons`)");
	});

	it("should generate a select with a WHERE condition",function() {
		var query =
			mydsl
				.select("field","table")
				.where("`field` = 1")
				.limit(10)
				.offset(10);

		query
			.getQuery()
			.toString()
			.should
			.equal("SELECT `table`.`field` FROM `table` WHERE `field` = 1 LIMIT 10 , 10");
	});
});