//! Tool order, after fx `parallel_execution.zig`: consecutive read-only calls
//! form one group that may run together; every other call runs alone. Each
//! group waits for the group before it. The host decides how much to run at
//! once inside a group.

/// fx keeps a group well below the host's pending-request limit.
pub const MAX_GROUP: usize = 16;

/// For each call (by index), the indices of the calls it must wait for.
pub fn order(read_only: &[bool]) -> Vec<Vec<usize>> {
    let mut after = Vec::with_capacity(read_only.len());
    let mut previous_group: Vec<usize> = Vec::new();
    let mut current_group: Vec<usize> = Vec::new();
    let mut current_is_read_only = false;
    for (i, &ro) in read_only.iter().enumerate() {
        let joins = ro && current_is_read_only && current_group.len() < MAX_GROUP;
        if !joins {
            if !current_group.is_empty() {
                previous_group = std::mem::take(&mut current_group);
            }
            current_is_read_only = ro;
        }
        current_group.push(i);
        after.push(previous_group.clone());
    }
    after
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_run_together_and_a_write_fences_the_batch() {
        // read, read, write, read
        assert_eq!(
            order(&[true, true, false, true]),
            vec![vec![], vec![], vec![0, 1], vec![2]]
        );
    }

    #[test]
    fn writes_run_alone_in_call_order() {
        assert_eq!(order(&[false, false]), vec![vec![], vec![0]]);
    }

    #[test]
    fn groups_are_capped() {
        let after = order(&[true; MAX_GROUP + 1]);
        assert!(after[MAX_GROUP - 1].is_empty());
        assert_eq!(after[MAX_GROUP], (0..MAX_GROUP).collect::<Vec<_>>());
    }
}
