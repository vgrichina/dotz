with connected_accounts as (
	select distinct on (receipt_predecessor_account_id)
		receipt_predecessor_account_id as account_id,
		args->'args_json'->>'username' as twitter_username
	from action_receipt_actions
	where receipt_receiver_account_id = 'dotz.near'
		and args->>'method_name' = 'setTwitterUsername'
	order by receipt_predecessor_account_id, receipt_included_in_block_timestamp desc
)
select connected_accounts.*,
	receipts.included_in_block_timestamp as created_at
from connected_accounts
join accounts on connected_accounts.account_id = accounts.account_id
join receipts on created_by_receipt_id = receipts.receipt_id

