(chars.name LIKE $1
    OR alt_name LIKE $1
    OR html_entity = $2
    OR code_hex = $2
    OR code = $3)
AND wgl4 = true ORDER BY code
