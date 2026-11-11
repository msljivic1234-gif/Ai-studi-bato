/** Shared execution meaning; catalog resolution is not a business Save. */
export function serviceExecutionInstruction(purpose = 'NEED_SERVICE') {
  if (!['NEED_SERVICE', 'WORKER_CAPABILITY'].includes(purpose)) throw new Error('EXECUTION_PURPOSE_INVALID');
  return [
    'Execution: ON_SITE = worker visit to requester/worksite or transport route. REMOTE = no visit: digital work or provider workshop. BOTH = both scopes, not a third mode. Infer an obvious scope (painting an apartment: ON_SITE); profession, city, equipment or catalog modes alone do not resolve ambiguous services.',
    'Clarify a physical-work/REMOTE contradiction; never substitute advice/design. A combined job requiring measurement, installation or worker delivery is ON_SITE. Customer pickup/external shipment is handoff, not a worker visit or transport service.',
    'REMOTE handoff: digital/no exchange {required:false}; physical {required:true,shippingCountries:["RS"]} and/or localExchange:{countryCode:"RS",city:"Novi Sad"}. required=true needs a stated option; countries are unique uppercase ISO2. Unknown: omit and ask the missing option, never assume digital-only/worldwide shipping. No exact address/contact data. Use structured constraints for matching, not prose.',
    purpose === 'WORKER_CAPABILITY'
      ? 'Resolve each offered service independently; one service/city never implies BOTH or shipping for another. An obvious initial scope can establish mode; changes follow serviceModeChangesJson and business Save.'
      : 'Preserve execution until scope changes. need.task_geography REMOTE has no work points; physical geography means ON_SITE. REMOTE review requires need.handoff: derive required:false for clearly digital work, otherwise stated physical options. Pickup/shipping is handoff, not a work pin. Classification uses the effective typed handoff, including unchanged facts.',
  ].join('\n');
}
