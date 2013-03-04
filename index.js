// Extremely simple DSL for generating mysql queries
// Doesn't actually guarantee valid queries. You have to compose sensibly...
// Also doesn't yet run parameterised queries. You need to be responsible for
// your own security. Don't use this thing if you don't know what it does.

// One day I'll rewrite this so it has no side-effects. One day.

function ComposeableQuery() {
	
	this.command = "SELECT";
	
	this.fields = [];
	
	this.joins = [];
	
	this.conditions = [];
	
	this.from = "";
	
	this.limit = null;
	
	this.offset = null;
	
	this.orderDirection = "ASC";
	
	this.orderField = null;
	
	this.orderTable = null;
	
};

ComposeableQuery.prototype.toString = function() {
	return compose(this);
};



function buildQuery() {
	var query = new ComposeableQuery();
	
	// Pattern to enable chaining DSL
	var chain = {

		"command": function(command) {
			// Todo: validate?
			
			query.command = command;
			
			return chain;
		},
		
		
		"addField": function(fieldName,fromTable) {
			
			if (typeof fieldName !== "string" &&
				!(fieldName instanceof ComposeableQuery)) {
				
				throw new Error("Field name must be a string or subquery.");
			}
			
			query.fields.push({
				"field": fieldName,
				"fromTable": fromTable
			});
			
			return chain;
		},
		
		
		"as": function(label) {
			
			if (!label)
				throw new Error("You must specify a label.");
			
			var field = query.fields.pop();
			
			if (!field)
				throw new Error("No fields present for labelling.");
			
			field.label = label;
			
			query.fields.push(field);
			
			return chain;
		},
		
		"from": function(fromData) {
			
			if (typeof fromData !== "string" &&
				!(fromData instanceof ComposeableQuery)) {
				
				throw new Error("Table name must be a string or subquery.");
			}
			
			query.from = fromData;
			
			return chain;
		},
		
		"join": function(fromData,kind,as) {
			
			if (!kind) kind = "LEFT";
			
			if (typeof fromData !== "string" &&
				!(fromData instanceof ComposeableQuery)) {
				
				throw new Error("You can only join on a string or subquery.");
			}
			
			query.joins.push({
				"join": fromData,
				"kind": kind,
				"condition": null,
				"as": as
			});
			
			return chain;
		},
		
		"on": function(condition) {
			
			// for the moment this is a string.
			// but I'll turn it into a special object soon.
			
			if (!condition)
				throw new Error("You must specify a join condition.");
			
			if (!query.joins.length)
				throw new Error("You must add a join before specifying a condition.");
			
			// Add the condition
			query.joins[query.joins.length-1].condition = condition;
			
			return chain;
		},
		
		"where": function(condition) {
			
			// for the moment this is a string.
			// but I'll turn it into a special object soon.
			if (condition)
				query.conditions.push(condition);
			
			return chain;
		},
		
		"limit": function(limit) {
			
			if (!limit || !(typeof limit === "number"))
				throw new Error("You must supply a valid number to limit.");
			
			query.limit = parseInt(limit,10);
			
			return chain;
		},
		
		"offset": function(offset) {
			
			if (!offset || !(typeof offset === "number"))
				throw new Error("You must supply a valid number to offset.");
			
			query.offset = parseInt(offset,10);
			
			return chain;
		},
		
		"order": function(field,direction) {
			
			if (direction !== "ASC" && direction !== "DESC")
				throw new Error("You must specify an order direction.");
			
			if (typeof field === "string" &&
				field.match(/\./)) {
				
				query.orderField = field.split(/\./i).pop();
				query.orderTable = field.split(/\./i).slice(0,-1).join(".");
				
			} else if (
					typeof field === "string" ||
					field instanceof ComposeableQuery) {
				
				query.orderField = field;
				
			} else {
				throw new Error("Order field must be a string or subquery.");
			}
			
			query.orderDirection = direction;
			
			return chain;
		},
		
		"getQuery": function() {
			return query;
		}
	};

	return chain;
}

function compose(query) {
	var queryTokens = [];
	
	function escape(input) {
		return "`" + input.replace(/[`]/ig,"\\`") + "`";
	}
	
	function escapeField(input,from) {
		if (!!from || typeof query.from === "string") {
			return escape(from || query.from) + "." + escape(input);
		}
		
		return escape(input);
	}
	
	function wrapSubQ(input) {
		return "(" + input + ")";
	}
	
	function composeOrEscape(input) {
		if (input instanceof ComposeableQuery) {
			return wrapSubQ(compose(input));	
		}
		
		return escape(input);
	}
	
	if (query.command === "select") {
		
		// Append command
		queryTokens.push("SELECT");
		
		// Add fields
		if (query.fields.length) {
			
			query.fields.forEach(function(field,index) {
					
				queryTokens.push(escapeField(field.field,field.fromTable));
				
				if (!!field.label) {
					queryTokens.push("AS");
					queryTokens.push(escape(field.label));
				}
				
				if (index < query.fields.length-1) {
					queryTokens.push(",");
				}
				
			});
			
		} else {
			
			// Assume we just want all the fields
			queryTokens.push("*");
		}
		
		// Now we add the table we're selecting from
		queryTokens.push("FROM",composeOrEscape(query.from));
		
		
		// JOINS
		if (query.joins && query.joins.length) {
			query.joins.forEach(function(join,index) {
				
				// We've gotta have all the parts...
				if (!join.kind || !join.join || !join.condition)
					throw new Error("Missing vital join data!");
				
				// Add the join...
				queryTokens.push(join.kind,"JOIN");
				queryTokens.push(composeOrEscape(join.join));
				
				// Are we joining as an alias?
				if (!! join.as)
					queryTokens.push("AS",escape(join.as))
				
				// And now the join condition
				queryTokens.push("ON",join.condition);
			});
		}
		
		
		// WHERE
		if (query.conditions.length) {
			queryTokens.push("WHERE",query.conditions.join(" AND "));
		}
		
		// Order
		if (!!query.orderField) {
			queryTokens.push(
				"ORDER BY",
				escapeField(query.orderField,query.orderTable),
				query.orderDirection);
		}
		
		// LIMIT
		if (query.limit) {
			
			queryTokens.push("LIMIT");
			
			if (query.offset) {
				queryTokens.push(query.offset,",");
			}
			
			queryTokens.push(query.limit);
		}
	}
	
	
	return queryTokens.join(" ");
};

module.exports = {
	
	"select": function(fields,from) {
		
		// Bootstrap a simple select query
		var query = buildQuery().command("select");
		
		// Were any fields specified?
		if (fields) {
			
			if (fields instanceof Array) {
				fields.forEach(function(field) {
					query = query.addField(field);
				});
			
			
			} else if (typeof fields === "string") {
				
				query = query.addField(fields);
				
			}
			
		}
		
		if (from) {
			
			if (typeof from !== "string" && !(from instanceof ComposableQuery))
				throw new Error("From must be a table name (string), or a composable query.");
			
			query = query.from(from);
		}
		
		return query;
	},
	
	// Passthrough
	"buildQuery": buildQuery
	
};