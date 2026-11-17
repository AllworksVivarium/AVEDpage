export function rankingIdentityMapper({isContainment,aliasFor}){
 return row=>isContainment(row.employeeId)?{...row,name:aliasFor(row.employeeId)||'匿名员工-'+row.employeeId,isContainment:true}:{...row,isContainment:false};
}
export function mapRankingIdentities(board,map){
 return Object.fromEntries(Object.entries(board).map(([key,value])=>[key,Array.isArray(value)?value.map(map):value]));
}
