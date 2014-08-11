SELECT CASE chars.name
    WHEN '<control>' THEN
        ''
    ELSE
        '&#' || code || ';'
    END AS char,
    chars.code,
    chars.code_hex AS "hexCode",
    chars.name,
    chars.alt_name AS "altName",
    chars.wgl4,
    chars.html_entity AS "htmlEntity",
    blocks.name AS block,
    blocks.id AS "blockId"
FROM chars INNER JOIN blocks ON chars.block_id = blocks.id
