## Reusable Flows

Reusable flows is a small package that helps you organize your code using Tanstack Query, it's used for declaring TS inputs and outputs, the objective is to type whatever your api is calling for (Thus aimed to non ts backends)

It's influenced by TRPC so the usage is similar

Just a drop in and use, but you have to configure tanstack working. Zod library is used for schema validations.


```typescript
//First declare an object containing procedures
 const tickets = {
  closeTicket: Flow.procedure
    .input(
      z.object({
        id: z.string(),
      })
  )
    .output(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx}) => {
      const { data } = await LocalRequestHelper({
        url: URLHelper("rrhh.tickets/closeTicket"),
        requestType: "post",
        data: input,
      })
      return data as z.infer<typeof ctx.schemeOutput>
    }, `cerrarTicket-tickets`),
}
//Then add it as a route which is an object with more objects
const routes = {
  other,
  tickets,
}
//And then build the api with apiBuilder
export const api = apiBuilder(routes)


```

That's all, others should be able to use your defined routes, with your specific inputs and outputs fully typed!

```typescript
const closeTicket = api.tickets.closeTicket.useMutation({
    onSuccess: () => {
      //something
    },
  })
```
