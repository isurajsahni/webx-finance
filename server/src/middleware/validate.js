// Validate and replace req.body / req.params with the parsed (coerced, stripped) data.
// req.query is a getter in Express 5, so parsed query lives on req.validatedQuery.
export const validate = (schemas) => (req, _res, next) => {
  if (schemas.params) req.params = schemas.params.parse(req.params);
  if (schemas.query) {
    // An empty filter (?status=) means "any", not an invalid value.
    const query = Object.fromEntries(Object.entries(req.query).filter(([, v]) => v !== ''));
    req.validatedQuery = schemas.query.parse(query);
  }
  if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
  next();
};
