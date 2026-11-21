const activityTargetName=target=>{
  const labels={employees:'员工名册',profiles:'个人档案',balance_ledger:'账户流水',checkins:'签到记录',game_tickets:'娱乐室票据',forum_threads:'匿名主题',forum_replies:'匿名回复',posts:'通告留言',dossiers:'收容卷宗',announcements:'公司通告',dossier_comments:'卷宗评议',chat_messages:'无线电通讯',stock_holdings:'证券持仓',news:'公司新闻通告',departments:'部门与员工名录',containment:'收容物卷宗',forum:'匿名论坛',casino:'员工娱乐室',profile:'个人档案',server_console:'监察控制台',activity:'监察记录',moderation:'图文核验',life_records:'生活记录'};
  if(target?.startsWith('/api/admin/'))return labels[target.split('/')[3]]||'监察记录';
  return labels[target]||target||'员工终端';
};
