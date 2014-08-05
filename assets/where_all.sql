chars.name LIKE $1
OR chars.alt_name LIKE $1
OR chars.html_entity = $2
OR chars.code_hex = $2
OR chars.code = $3 ORDER BY code LIMIT
